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
from urllib.parse import urlsplit, urljoin

from bs4 import BeautifulSoup
from camoufox.async_api import AsyncCamoufox
from magicmd.platforms.csdn import parse_csdn_html

MAGICMD_COMMIT = "78aa27f2ffb7d541a8f65508cf5e5bde43a636e4"
BROWSER_VERSION = "158.0.1-beta.41"


def compact(value):
    return "".join(c.lower() for c in value if c.isalnum())


def stats(html):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.select("script,style,.toc,.hljs-button,.hljs-ln-numbers,.code-tool-box,.opt-box,.pre-numbering,.hide-preCode-box"):
        tag.decompose()
    return {"textCharacters": len(compact(soup.get_text())),
            "images": len(soup.select("img[src],img[data-src]")),
            "codeBlocks": sum(bool(compact(t.get_text())) for t in soup.select("pre")), "tables": len(soup.select("table")),
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
    # MagicMD stores code outside content_html and restores it into Markdown.
    extracted["codeBlocks"] = len(re.findall(r"(?m)^\s{0,3}(?:`{3,}|~{3,})[^\n]*$", article.content_markdown)) // 2
    source_images = {urljoin(case["url"], tag.get("data-src") or tag.get("src")) for tag in cleaned.select("img") if tag.get("data-src") or tag.get("src")}
    output_images = {urljoin(case["url"], image.source_url) for image in article.images}
    source["images"] = len(source_images)
    extracted["images"] = len(output_images)
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
    for key in ["codeBlocks", "tables"]:
        if extracted[key] < source[key]:
            issues.append(key + "_changed")
    if source_images - output_images:
        issues.append("images_changed")
    if page_info and page_info.get("restrictionVisible"):
        issues.append("visible_reading_restriction")
    extracted_ok = bool(article.content_html.strip() and (extracted["textCharacters"] or extracted["images"]))
    return {"accessSuccess": True, "extractionSuccess": extracted_ok,
            "quality": "structure_preserved" if extracted_ok and not issues else "review_required",
            "source": source, "extracted": extracted, "markdownCoverage": round(coverage, 5),
            "issues": issues, "parserWarnings": article.extraction.warnings,
            "missingImages": sorted(source_images - output_images),
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
    responses = []
    def navigation(response):
        if response.request.is_navigation_request() and response.frame == page.main_frame:
            statuses.append(response.status)
            responses.append(response)
    page.on("response", navigation)
    try:
        response_html = None
        try:
            await page.goto(case["url"], wait_until="domcontentloaded", timeout=30000)
        except Exception:
            # Third-party scripts can stall DOMContentLoaded after the final
            # article response is complete. Preserve that response, not a
            # half-parsed DOM or the original 521 challenge.
            if not responses or responses[-1].status != 200:
                raise
            response_html = await responses[-1].text()
            if not BeautifulSoup(response_html, "html.parser").select_one("#content_views"):
                raise
            row["navigationWarning"] = "dom_timeout_complete_article_response_preserved"
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
        html = response_html if response_html is not None else await page.content()
        row["captureMethod"] = "complete_browser_response" if response_html is not None else "rendered_dom"
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
                try:
                    await page.screenshot(path=str(article_dir / "original.png"), timeout=15000)
                except Exception as error:
                    row["screenshotError"] = type(error).__name__
        elif args.screenshots and len(list(output.glob("failure-*.png"))) < 3:
            try:
                await page.screenshot(path=str(output / ("failure-" + case["id"] + ".png")), timeout=15000)
            except Exception as error:
                row["screenshotError"] = type(error).__name__
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
    if args.ids:
        selected = set(args.ids.split(","))
        cases = [case for case in cases if case["id"] in selected]
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
    if args.resume and (output / "report.json").exists():
        previous = json.loads((output / "report.json").read_text(encoding="utf-8"))
        assert previous["inputSha256"] == report["inputSha256"] and previous["environment"] == report["environment"]
        report["results"] = previous["results"]
        if args.retry_failed:
            report["previousFailures"] = previous.get("previousFailures", []) + [row for row in previous["results"] if not row.get("accessSuccess")]
            report["results"] = [row for row in previous["results"] if row.get("accessSuccess")]
        report["startedAt"] = previous["startedAt"]
        report["resumedAt"] = datetime.now(timezone.utc).isoformat()
        done = {row["id"] for row in report["results"]}
        cases = [case for case in cases if case["id"] not in done]
    report["workers"] = args.workers
    options = {"headless": True}
    if args.executable_path:
        options["executable_path"] = args.executable_path
        report["browserAssets"] = "Official native Windows binaries, ZIP CRC verified; inactive cross-platform font bundle omitted"
    if args.native_os:
        options["os"] = {"Windows": "windows", "Linux": "linux", "Darwin": "macos"}[platform.system()]
        report["nativeOs"] = True
    if args.proxy_env:
        proxy = urlsplit(os.environ[args.proxy_env])
        options["proxy"] = {"server": f"{proxy.scheme}://{proxy.hostname}:{proxy.port}"}
        if proxy.username:
            options["proxy"].update(username=proxy.username, password=proxy.password or "")
    async with AsyncCamoufox(**options) as browser:
        report["browserVersion"] = browser.version
        assert report["browserVersion"] == BROWSER_VERSION, "Browser version differs from the fixed experiment"
        queue = list(cases)
        async def worker():
            while queue:
                case = queue.pop(0)
                row = await fetch_one(browser, case, args, output)
                attempts = [{k: row.get(k) for k in ["accessSuccess", "reason", "error", "navigationStatuses"]}]
                if not row.get("accessSuccess"):
                    await asyncio.sleep(5)
                    row = await fetch_one(browser, case, args, output)
                    attempts.append({k: row.get(k) for k in ["accessSuccess", "reason", "error", "navigationStatuses"]})
                row["attempts"] = attempts
                report["results"].append(row)
                save_report(output / "report.json", report)
                print(json.dumps({"completed": len(report["results"]), "inputTotal": 114, **{k: row.get(k) for k in ["id", "quality", "reason", "navigationStatuses"]}}, ensure_ascii=False), flush=True)
                await asyncio.sleep(2)
        await asyncio.gather(*(worker() for _ in range(args.workers)))
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
    p.add_argument("--ids")
    p.add_argument("--wait-ms", type=int, default=15000)
    p.add_argument("--proxy-env")
    p.add_argument("--executable-path")
    p.add_argument("--native-os", action="store_true")
    p.add_argument("--workers", type=int, choices=[1, 2], default=1)
    p.add_argument("--resume", action="store_true")
    p.add_argument("--retry-failed", action="store_true")
    p.add_argument("--screenshots", action="store_true")
    asyncio.run(main(p.parse_args()))
