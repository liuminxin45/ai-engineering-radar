import * as cheerio from "cheerio";
import type { Candidate, Source } from "../../shared/types.js";
import { allowedHost, CrawlError } from "../http.js";

const text = (value: unknown, max: number) =>
  cheerio
    .load(`<body>${String(value ?? "")}</body>`)
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const timestamp = (value: unknown) => {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  if (
    !Number.isFinite(+parsed) ||
    parsed.getUTCFullYear() < 1990 ||
    +parsed > Date.now() + 86400000
  )
    return undefined;
  return parsed.toISOString();
};
const excerpt = (value: unknown) => {
  const summary = text(value, 1601);
  return summary && summary.length <= 1600 ? summary.slice(0, 800) : undefined;
};

function requireAccounts(source: Source) {
  if (!source.authorAllowlist?.length)
    throw new CrawlError(
      "Community source requires reviewed account identifiers",
      undefined,
      true,
    );
  return source.authorAllowlist;
}

/** Public QQNews author API. Every item must carry the reviewed stable SUID. */
export function parseTencentNews(json: string, source: Source): Candidate[] {
  const accounts = requireAccounts(source);
  let response: any;
  try {
    response = JSON.parse(json);
  } catch {
    throw new CrawlError("Tencent news response is not valid JSON");
  }
  if (!response || response.ret !== 0 || !Array.isArray(response.newslist))
    throw new CrawlError("Tencent news author listing unavailable");
  const requested = new URL(source.url).searchParams.get("guestSuid");
  if (!requested || !accounts.includes(requested))
    throw new CrawlError(
      "Tencent news endpoint does not match reviewed account",
      undefined,
      true,
    );
  const items = new Map<string, Candidate>();
  for (const item of response.newslist) {
    if (!item || typeof item !== "object") continue;
    if (!accounts.includes(String(item.card?.suid ?? ""))) continue;
    const id = String(item.id ?? "");
    if (!/^[A-Za-z0-9]{8,40}$/.test(id)) continue;
    const url = `https://news.qq.com/rain/a/${id}`;
    const title = text(item.title, 600);
    if (!title || !allowedHost(source, url)) continue;
    const publishedAt =
      typeof item.timestamp === "number" &&
      Number.isFinite(item.timestamp) &&
      item.timestamp > 0 &&
      item.timestamp < 8640000000000
        ? timestamp(new Date(item.timestamp * 1000).toISOString())
        : timestamp(
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(item.time))
              ? String(item.time).replace(" ", "T") + "+08:00"
              : undefined,
          );
    items.set(id, {
      title,
      url,
      externalId: id,
      author: text(item.card?.chlname ?? item.source, 300) || undefined,
      description: excerpt(item.abstract),
      publishedAt,
      language: "zh-CN",
    });
  }
  return [...items.values()];
}

/** Account-scoped cnblogs HTML avoids feed.cnblogs.com's disallowed robots paths. */
export function parseCnblogsAccount(html: string, source: Source): Candidate[] {
  const accounts = requireAccounts(source).map((v) => v.toLowerCase());
  const account = new URL(source.entryUrl).pathname
    .split("/")
    .filter(Boolean)[0]
    ?.toLowerCase();
  if (!account || !accounts.includes(account))
    throw new CrawlError(
      "Cnblogs entry does not match reviewed account",
      undefined,
      true,
    );
  const $ = cheerio.load(html),
    items = new Map<string, Candidate>();
  $(source.selector ?? ".postTitle a").each((_, el) => {
    const a = $(el);
    let url: URL;
    try {
      url = new URL(a.attr("href") ?? "", source.url);
    } catch {
      return;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !allowedHost(source, url.href) ||
      parts.length !== 3 ||
      parts[0]?.toLowerCase() !== account ||
      parts[1] !== "p" ||
      !/^\d+(?:\.html)?$/.test(parts[2] ?? "")
    )
      return;
    if (
      source.linkPattern &&
      !new RegExp(source.linkPattern).test(url.pathname)
    )
      return;
    const title = text(a.text(), 600).replace(/^\[置顶\]\s*/, "");
    if (!title) return;
    const heading = a.closest(".postTitle");
    const summary = heading
      .nextAll(".postCon")
      .first()
      .find(".c_b_p_desc")
      .text()
      .replace(/^\s*摘要：\s*/, "")
      .replace(/阅读全文\s*$/, "");
    const desc = heading.nextAll(".postDesc").first().text();
    const time = desc.match(
      /posted\s*@\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?/i,
    );
    const publishedAt = time
      ? timestamp(`${time[1]}T${time[2]}:${time[3] ?? "00"}+08:00`)
      : undefined;
    items.set(url.href, {
      title,
      url: url.href,
      externalId: parts[2].replace(/\.html$/, ""),
      author: account,
      description: excerpt(summary),
      publishedAt,
      language: "zh-CN",
    });
  });
  return [...items.values()];
}
