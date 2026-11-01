import * as cheerio from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Candidate, Source, SourceState } from "../shared/types.js";
import {
  allowedHost,
  fetchReviewed,
  type HttpResult,
  CrawlError,
} from "./http.js";
import {
  parseCnblogsAccount,
  parseTencentNews,
} from "./platforms/community.js";
import { parseAliyunGroup, nextAliyunPage } from "./platforms/aliyun.js";
import { parseVolcengineAccount } from "./platforms/volcengine.js";
export const plain = (s: unknown, max = 800) =>
  cheerio
    .load(`<body>${String(s ?? "")}</body>`)
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
export const date = (s: unknown): string | undefined => {
  if (!s) return;
  const d = new Date(String(s));
  if (
    !Number.isFinite(+d) ||
    d.getUTCFullYear() < 1990 ||
    +d > Date.now() + 86400000
  )
    return;
  return d.toISOString();
};
const arr = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const value = (v: any): string =>
  typeof v === "object"
    ? String(v?.["#text"] ?? v?.name ?? "")
    : String(v ?? "");
function shortSummary(input: unknown) {
  const t = plain(input, 1601);
  return t && t.length <= 1600 ? t.slice(0, 800) : undefined;
}
export function parseFeed(xml: string, source: Source): Candidate[] {
  if (XMLValidator.validate(xml) !== true)
    throw new CrawlError("Invalid feed XML");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
  }).parse(xml);
  const channel = parsed.rss?.channel ?? parsed["rdf:RDF"];
  const atom = parsed.feed;
  if (!channel && !atom)
    throw new CrawlError("Response is not an RSS/Atom feed");
  const items = arr(channel?.item ?? atom?.entry);
  return items.flatMap((item: any) => {
    const links = arr(item.link);
    const atomLink = links.find(
      (l) =>
        typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate"),
    )?.["@_href"];
    const link = atomLink ?? value(item.link);
    let url: string;
    try {
      url = new URL(link, source.url).href;
    } catch {
      return [];
    }
    if (
      !["http:", "https:"].includes(new URL(url).protocol) ||
      !allowedHost(source, url)
    )
      return [];
    const title = plain(value(item.title), 600);
    if (!title || !link) return [];
    const author =
      plain(value(item.author ?? item["dc:creator"] ?? atom?.author), 300) ||
      undefined;
    if (
      source.authorAllowlist?.length &&
      !source.authorAllowlist.includes(author ?? "")
    )
      return [];
    if (
      source.linkPattern &&
      !new RegExp(source.linkPattern).test(new URL(url).pathname)
    )
      return [];
    return [
      {
        title,
        url,
        externalId: value(item.guid ?? item.id) || undefined,
        author,
        // These publishers place full article bodies in description/summary.
        // Read only metadata here; a page's own meta description may supply an excerpt.
        description: ["segmentfault-feed", "team-blog-feed"].includes(
          source.platform,
        )
          ? undefined
          : shortSummary(value(item.description ?? item.summary)),
        publishedAt: date(
          item.pubDate ?? item.published ?? item["dc:date"] ?? item.updated,
        ),
        language: value(channel?.language ?? atom?.["@_xml:lang"]) || undefined,
      },
    ];
  });
}
export function parseListing(html: string, source: Source): Candidate[] {
  if (source.platform === "aliyun-group") return parseAliyunGroup(html, source);
  if (source.platform === "volcengine-account")
    return parseVolcengineAccount(html, source);
  if (source.platform === "tencent-news") return parseTencentNews(html, source);
  if (source.platform === "cnblogs-account")
    return parseCnblogsAccount(html, source);
  if (source.platform === "tencent-column")
    return parseTencentColumn(html, source);
  if (!source.selector)
    throw new CrawlError("HTML source has no site-specific selector");
  const $ = cheerio.load(html);
  const items = new Map<string, Candidate>();
  $(source.selector).each((_, el) => {
    const a = $(el);
    let url: string;
    try {
      url = new URL(a.attr("href") ?? "", source.url).href;
    } catch {
      return;
    }
    if (
      !allowedHost(source, url) ||
      (source.linkPattern &&
        !new RegExp(source.linkPattern).test(new URL(url).pathname))
    )
      return;
    const title = plain(
      a.find("h1,h2,h3,h4").first().text() || a.attr("aria-label") || a.text(),
      600,
    );
    if (
      title.length < 8 ||
      /^(read more|learn more|阅读全文|了解更多)$/i.test(title)
    )
      return;
    const container = a.closest("article,li");
    const time = container.find("time").first();
    const description = shortSummary(container.find("p").first().text());
    const candidate = {
      title,
      url,
      description:
        description && description !== title ? description : undefined,
      publishedAt: date(time.attr("datetime") || time.text()),
    };
    if (!items.has(url)) items.set(url, candidate);
  });
  return [...items.values()];
}
export function parseTencentColumn(html: string, source: Source): Candidate[] {
  const $ = cheerio.load(html);
  let data: any;
  try {
    data = JSON.parse($("#__NEXT_DATA__").text());
  } catch {
    throw new CrawlError("Tencent column structured listing unavailable");
  }
  const fallback = data?.props?.pageProps?.fallback ?? {};
  const lists = Object.entries(fallback)
    .filter(([key]) => key.includes("/api/column/getArticlesByColumnId"))
    .flatMap(([, v]) => arr(v).flatMap((page) => arr(page.list)));
  if (!source.authorAllowlist?.length)
    throw new CrawlError("Tencent column requires reviewed author IDs");
  return lists
    .filter((item) =>
      source.authorAllowlist!.includes(String(item.author?.uid ?? item.uid)),
    )
    .map((item) => ({
      title: plain(item.title, 600),
      url: `https://cloud.tencent.com/developer/article/${item.articleId}`,
      externalId: String(item.articleId),
      author: plain(item.author?.nickname, 300),
      description: shortSummary(item.summary),
      publishedAt: date(
        String(item.createTime).replaceAll("/", "-").replace(" ", "T") +
          "+08:00",
      ),
      language: "zh-CN",
    }));
}
export function parseMetadata(
  html: string,
  url: string,
  source?: Source,
): Partial<Candidate> {
  const $ = cheerio.load(html);
  const meta = (key: string) =>
    $(`meta[property="${key}"],meta[name="${key}"]`)
      .toArray()
      .map((el) => $(el).attr("content"))
      .find(Boolean);
  let ld: any = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      const entries = arr(parsed["@graph"] ?? parsed);
      const found = entries.find((v: any) =>
        /Article|BlogPosting|TechArticle/.test(arr(v["@type"]).join(" ")),
      );
      if (found) ld = found;
    } catch {
      /* Invalid optional structured metadata is ignored. */
    }
  });
  const canonical = $('link[rel="canonical"]').attr("href");
  let canonicalUrl: string | undefined;
  try {
    if (canonical) {
      const c = new URL(canonical, url);
      if (["http:", "https:"].includes(c.protocol)) canonicalUrl = c.href;
    }
  } catch {}
  const author =
    meta("author") ??
    (typeof ld.author === "string"
      ? ld.author
      : arr(ld.author)
          .map((a: any) => a.name)
          .filter(Boolean)
          .join(", "));
  let specificDate = source?.metadata?.dateSelector
    ? $(source.metadata.dateSelector).first().text().trim()
    : undefined;
  if (
    specificDate &&
    /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(specificDate)
  )
    specificDate =
      specificDate.replace(" ", "T") +
      (specificDate.length === 10 ? "T00:00:00" : "") +
      (source?.metadata?.timezone ?? "Z");
  return {
    title:
      plain(meta("og:title") ?? ld.headline ?? $("h1").first().text(), 600) ||
      undefined,
    canonicalUrl,
    description: shortSummary(
      meta("description") ?? meta("og:description") ?? ld.description,
    ),
    publishedAt: date(
      meta("article:published_time") ??
        ld.datePublished ??
        $("time[datetime]").first().attr("datetime") ??
        specificDate,
    ),
    author: author ? plain(author, 300) : undefined,
    language: $("html").attr("lang"),
  };
}
export async function collect(
  source: Source,
  state: SourceState,
  limit: number,
): Promise<{ items: Candidate[]; response: HttpResult; warnings: string[] }> {
  const headers: Record<string, string> = {};
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;
  const response = await fetchReviewed(source.url, source, headers);
  if (response.status === 304) return { items: [], response, warnings: [] };
  const items = (
    source.adapter === "feed"
      ? parseFeed(response.text, source)
      : parseListing(response.text, source)
  ).slice(0, limit);
  if (source.platform === "aliyun-group") {
    const unique = new Map(items.map((item) => [item.url, item]));
    const visited = new Set([source.url]);
    let current = response;
    while (unique.size < limit && visited.size < 10) {
      const pageSource = { ...source, url: current.url };
      const next = nextAliyunPage(current.text, pageSource);
      if (!next || visited.has(next)) break;
      visited.add(next);
      current = await fetchReviewed(next, source);
      const pageItems = parseAliyunGroup(current.text, {
        ...source,
        url: next,
      });
      if (!pageItems.length)
        throw new CrawlError(
          "Aliyun paginated listing has no reviewed article metadata",
        );
      for (const item of pageItems) unique.set(item.url, item);
    }
    items.splice(0, items.length, ...[...unique.values()].slice(0, limit));
  }
  if (!items.length)
    throw new CrawlError(
      "No article entries parsed; source adapter or publisher filter requires review",
    );
  const warnings: string[] = [];
  // Public account feeds already provide the index metadata. Never fan out into
  // CSDN's restricted article HTML or full-text feed pages just for an excerpt.
  const skipArticleMetadata = [
    "csdn-feed",
    "segmentfault-feed",
    "team-blog-feed",
    "aliyun-group",
    "volcengine-account",
  ].includes(source.platform);
  for (const item of items) {
    // Only retrieve metadata when a listing/feed lacks a useful excerpt or date.
    if (
      (item.description && item.publishedAt) ||
      !allowedHost(source, item.url) ||
      skipArticleMetadata
    )
      continue;
    try {
      const page = await fetchReviewed(item.url, source);
      const metadata = parseMetadata(page.text, item.url, source);
      for (const key of [
        "description",
        "publishedAt",
        "author",
        "language",
        "canonicalUrl",
      ] as const) {
        if (!item[key] && metadata[key]) item[key] = metadata[key];
      }
      if (metadata.title && source.adapter === "html")
        item.title = metadata.title;
    } catch (e) {
      warnings.push(
        e instanceof CrawlError ? e.message : "Article metadata request failed",
      );
    }
  }
  return { items, response, warnings };
}
