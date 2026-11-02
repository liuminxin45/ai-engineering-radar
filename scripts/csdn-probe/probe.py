"""Isolated MagicMD/Camoufox experiment. Never writes the production snapshot."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import os
import platform
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from camoufox.async_api import AsyncCamoufox
from magicmd.platforms.csdn import parse_csdn_html

MAGICMD_COMMIT = "78aa27f2ffb7d541a8f65508cf5e5bde43a636e4"


def compact(value):
    return "".join(c.lower() for c in value if c.isalnum())


def stats(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.select("script,style,.toc,.hljs-button,.hljs-ln-numbers,.code-tool-box"):
        tag.decompose()
    return {"textCharacters": len(compact(soup.get_text())),
            "images": len(soup.select("img[src],img[data-src]")),
            "codeBlocks": len(soup.select("pre")), "tables": len(soup.select("table")),
            "headings": len(soup.select("h1,h2,h3,h4,h5,h6"))}, soup


def assess(html, case, page_info=None):
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("#content_views")
    title_tag = soup.select_one("#articleContentId,.title-article,h1")
    page_title = soup.title.get_text(strip=True) if soup.title else ""
    if not container:
        return {"accessSuccess": False, "extractionSuccess": False,
                "quality": "unavailable", "reason": "content_views_missing",
                "pageTitle": page_title[:200]}, None
    article = parse_csdn_html(html, case["url"])
    source, cleaned = stats(str(container))
    extracted, _ = stats(article.content_html)
    markdown = compact(article.content_markdown)
    # Compare against the actual DOM, not a length threshold or RSS summary.
    blocks = [compact(t.get_text()) for t in cleaned.select("p,pre,li,td,h1,h2,h3,h4,h5,h6")]
    grams = Counter(g for block in blocks for g in [block[i:i+6] for i in range(max(0, len(block)-5))])
    matched = sum(count for gram, count in grams.items() if gram in markdown)
    coverage = matched / sum(grams.values()) if grams else 1.0
    issues = []
    source_title = compact(title_tag.get_text()) if title_tag else ""
    expected_title = compact(case["title"])
    if not source_title or (expected_title not in source_title and source_title not in expected_title):
        issues.append("title_mismatch")
    if not article.content_html.strip() or not (extracted["textCharacters"] or extracted["images"]):
        issues.append("empty_body")
    if article.extraction.status != "success":
        issues.extend(article.extraction.warnings)
    if compact(case.get("description", "")) and compact(cleaned.get_text()) == compact(case["description"]):
        issues.append("matches_rss_summary")
    if re.search(r"(?:登录后|付费后|订阅后|购买后).{0,8}(?:查看|阅读)|仅展示部分|本文仅供.{0,5}试看", cleaned.get_text()):
        issues.append("explicit_reading_restriction")
    if coverage < 0.95:
        issues.append("markdown_text_loss")
    for key in ["images", "codeBlocks", "tables"]:
        if extracted[key] < source[key]:
            issues.append(key + "_changed")
    if page_info and page_info.get("restrictionVisible"):
        issues.append("visible_reading_restriction")
    extracted_ok = bool(article.content_html.strip() and (extracted["textCharacters"] or extracted["images"]))
    return {"accessSuccess": True, "extractionSuccess": extracted_ok,
            "quality": "structure_preserved" if extracted_ok and not issues else "review_required",
            "source": source, "extracted": extracted, "markdownCoverage": round(coverage, 5),
            "issues": issues, "parserWarnings": article.extraction.warnings,
            "title": article.title, "author": article.author, "publishedAt": article.published_at,
            "markdownSha256": hashlib.sha256(article.content_markdown.encode()).hexdigest()}, article


def validate_cases(data):
    assert data["validationOnly"] is True and len(data["articles"]) == 114
    seen = set()
    for case in data["articles"]:
        u = urlsplit(case["url"])
        assert u.scheme == "https" and u.hostname == "blog.csdn.net"
        assert re.fullmatch(r"/[A-Za-z0-9_-]+/article/details/\d+", u.path)
        assert case["id"] not in seen
        seen.add(case["id"])


def save_report(path, report):
    rows = report["results"]
    report["summary"] = {"attempted": len(rows),
        "accessSuccess": sum(bool(x.get("accessSuccess")) for x in rows),
        "extractionSuccess": sum(bool(x.get("extractionSuccess")) for x in rows),
        "structurePreserved": sum(x.get("quality") == "structure_preserved" for x in rows),
        "reviewRequired": sum(x.get("quality") == "review_required" for x in rows),
        "failures": dict(Counter(x.get("reason", "unknown") for x in rows if not x.get("accessSuccess")))}
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


async def fetch_one(browser, case, args, output):
    started = time.monotonic()
    row = {"id": case["id"], "sourceId": case["sourceId"], "url": case["url"]}
    context = await browser.new_context()
    page = await context.new_page()
    statuses = []
    page.on("response", lambda r: statuses.append(r.status) if r.request.is_navigation_request() and r.frame == page.main_frame else None)
    try:
        await page.goto(case["url"], wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_selector("#content_views", timeout=args.wait_ms)
        except Exception:
            pass
        await page.wait_for_timeout(1000)
        info = await page.evaluate("""() => ({
          finalUrl: location.href,
          imagesLoaded: [...document.querySelectorAll('#content_views img')].filter(x => x.complete && x.naturalWidth > 0).length,
          imagesFailed: [...document.querySelectorAll('#content_views img')].filter(x => x.complete && x.naturalWidth === 0).length,
          restrictionVisible: [...document.querySelectorAll('.hide-article-box,.readall_box,.article-pay-box')].some(x =>
            x.getBoundingClientRect().height > 0 && /购买|付费|VIP专享|订阅后|登录后查看/.test(x.textContent))
        })""")
        html = await page.content()
        assessment, article = assess(html, case, info)
        row.update(assessment)
        row.update(info)
        if article:
            article_dir = output / "articles" / case["id"]
            article_dir.mkdir(parents=True, exist_ok=True)
            (article_dir / "article.md").write_text(article.content_markdown, encoding="utf-8")
            # Only body markup, never the raw page, cookies, headers or storage state.
            (article_dir / "body.html").write_text(article.content_html, encoding="utf-8")
            (article_dir / "source-body.html").write_text(str(BeautifulSoup(html, "html.parser").select_one("#content_views")), encoding="utf-8")
            if args.screenshots:
                await page.screenshot(path=str(article_dir / "original.png"), full_page=True, timeout=15000)
        elif args.screenshots and len(list(output.glob("failure-*.png"))) < 3:
            await page.screenshot(path=str(output / ("failure-" + case["id"] + ".png")), timeout=15000)
    except Exception as error:
        row.update(accessSuccess=False, extractionSuccess=False, quality="unavailable",
                   reason=type(error).__name__, error=str(error).split("Call log:")[0][:350])
    finally:
        row["navigationStatuses"] = statuses
        row["durationSeconds"] = round(time.monotonic()-started, 2)
        await context.close()
    return row


async def main(args):
    raw = Path(args.input).read_bytes()
    data = json.loads(raw)
    validate_cases(data)
    cases = data["articles"][args.shard::args.shards]
    if args.limit:
        cases = cases[:args.limit]
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    report = {"schemaVersion": 1, "startedAt": datetime.now(timezone.utc).isoformat(),
        "inputSha256": hashlib.sha256(raw).hexdigest(), "inputTotal": 114,
        "environment": args.environment, "os": platform.platform(), "python": platform.python_version(),
        "magicmdCommit": MAGICMD_COMMIT, "camoufox": importlib.metadata.version("camoufox"),
        "playwright": importlib.metadata.version("playwright"), "shard": args.shard,
        "shards": args.shards, "proxyConfigured": bool(args.proxy_env),
        "method": "MagicMD CSDN parser with default headless Camoufox; browser process reused, fresh context per article",
        "waitMs": args.wait_ms, "results": []}
    options = {"headless": True}
    if args.proxy_env:
        proxy = urlsplit(os.environ[args.proxy_env])
        options["proxy"] = {"server": f"{proxy.scheme}://{proxy.hostname}:{proxy.port}"}
        if proxy.username:
            options["proxy"].update(username=proxy.username, password=proxy.password or "")
    async with AsyncCamoufox(**options) as browser:
        report["browserVersion"] = browser.version
        for case in cases:
            row = await fetch_one(browser, case, args, output)
            report["results"].append(row)
            save_report(output / "report.json", report)
            print(json.dumps({"completed": len(report["results"]), "total": len(cases), **{k: row.get(k) for k in ["id", "quality", "reason", "navigationStatuses"]}}, ensure_ascii=False), flush=True)
            await asyncio.sleep(2)
    report["completedAt"] = datetime.now(timezone.utc).isoformat()
    save_report(output / "report.json", report)
    print(json.dumps(report["summary"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input", default=str(Path(__file__).with_name("input.json")))
    p.add_argument("--output", required=True)
    p.add_argument("--environment", required=True)
    p.add_argument("--shard", type=int, default=0)
    p.add_argument("--shards", type=int, default=1)
    p.add_argument("--limit", type=int)
    p.add_argument("--wait-ms", type=int, default=15000)
    p.add_argument("--proxy-env")
    p.add_argument("--screenshots", action="store_true")
    asyncio.run(main(p.parse_args()))
