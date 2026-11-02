import * as cheerio from "cheerio";
import { z } from "zod";
import type { Candidate, Source } from "../shared/types.js";
import { CrawlError } from "./http.js";
import { normalizeUrl } from "./deduplicate.js";

const itemSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  creator: z.string().optional(),
  author: z.string().optional(),
  guid: z.string().optional(),
  isoDate: z.string().optional(),
  pubDate: z.string().optional(),
  content: z.string().optional(),
  contentSnippet: z.string().optional(),
  description: z.string().nullable().optional(),
});
const feedSchema = z.object({
  title: z.string(),
  item: z.array(itemSchema).max(100),
});
type FeedItem = z.infer<typeof itemSchema>;
const text = (html: string) =>
  cheerio.load(html).text().replace(/\s+/g, " ").trim();

export function csdnAccount(source: Source) {
  const url = new URL(source.url);
  const account = url.pathname.match(/^\/([A-Za-z0-9_]+)\/rss\/map$/)?.[1];
  if (
    source.platform !== "csdn-feed" ||
    url.origin !== "https://rss.csdn.net" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !account ||
    source.authorAllowlist?.length !== 1 ||
    source.authorAllowlist[0] !== account ||
    source.linkPattern !== `^/${account}/article/details/[0-9]+/?$`
  )
    throw new CrawlError(
      "RSSHub CSDN route requires a reviewed account and article path",
    );
  return account;
}
function reviewedItem(item: FeedItem, source: Source) {
  const account = csdnAccount(source);
  const url = new URL(item.link);
  return (
    url.origin === "https://blog.csdn.net" &&
    !url.username &&
    !url.password &&
    new RegExp(source.linkPattern!).test(url.pathname) &&
    (item.creator ?? item.author) === account &&
    (!item.author || item.author === account)
  );
}
export function parseRssHubFeed(data: unknown, source: Source) {
  csdnAccount(source);
  const parsed = feedSchema.safeParse(data);
  if (!parsed.success) throw new CrawlError("RSSHub returned an invalid feed");
  const items = parsed.data.item.filter((item) => reviewedItem(item, source));
  if (!items.length)
    throw new CrawlError("RSSHub feed contains no reviewed account articles");
  return items;
}
export function rssHubCandidates(items: FeedItem[]): Candidate[] {
  return items
    .map((item) => {
      const published = new Date(item.isoDate || item.pubDate || "");
      const summary = text(item.content || item.contentSnippet || "").slice(
        0,
        800,
      );
      return {
        title: text(item.title).slice(0, 600),
        url: item.link,
        externalId: item.guid || item.link,
        author: item.creator || item.author,
        description: summary || undefined,
        publishedAt:
          Number.isFinite(+published) &&
          published.getUTCFullYear() >= 1990 &&
          +published <= Date.now() + 86400000
            ? published.toISOString()
            : undefined,
      };
    })
    .filter((item) => item.title);
}
export function rssHubBody(items: FeedItem[], url: string) {
  const item = items.find(
    (item) => normalizeUrl(item.link) === normalizeUrl(url),
  );
  if (!item) throw new CrawlError("RSSHub 当前账号订阅中没有这篇历史文章。");
  // RSSHub's CSDN handler adds `description` only after extracting #content_views.
  // Its catch branch returns the original RSS item (`content` is only a summary).
  const body = item.description?.trim();
  if (
    !body ||
    !text(body) ||
    text(body) === text(item.content || item.contentSnippet || "")
  )
    throw new CrawlError(
      "RSSHub 未取得 CSDN 正文，仅返回摘要（原站可能仍受 521 限制）。",
    );
  return body;
}

export function createRssHubClient(
  base = process.env.RSSHUB_URL,
  transport = fetch,
) {
  if (!base) return undefined;
  const endpoint = new URL(base.endsWith("/") ? base : `${base}/`);
  if (
    !["https:", "http:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))
  )
    throw new Error(
      "RSSHUB_URL must be HTTPS or a local loopback HTTP service URL",
    );
  async function read(path: string, source: Source, etag?: string) {
    const response = await transport(new URL(path, endpoint), {
      signal: AbortSignal.timeout(180_000),
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
    });
    if (response.status === 304)
      return {
        items: [] as FeedItem[],
        status: 304,
        etag: response.headers.get("etag") || etag,
      };
    if (!response.ok) {
      await response.body?.cancel();
      throw new CrawlError(`RSSHub HTTP ${response.status}`, response.status);
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (response.body)
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          await response.body.cancel().catch(() => {});
          throw new CrawlError("RSSHub response exceeds 16 MiB limit");
        }
        chunks.push(chunk);
      }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new CrawlError("RSSHub returned invalid JSON");
    }
    return {
      items: parseRssHubFeed(data, source),
      status: 200,
      etag: response.headers.get("etag") || undefined,
    };
  }
  const cache = new Map<string, Promise<FeedItem[]>>();
  async function cached(path: string, source: Source) {
    if (!cache.has(path))
      cache.set(
        path,
        read(path, source).then((result) => result.items),
      );
    return cache.get(path)!;
  }
  const load = (source: Source, options: { fullText?: boolean } = {}) =>
    cached(
      `csdn/${options.fullText ? "blog" : "index"}/${csdnAccount(source)}`,
      source,
    );
  return Object.assign(load, {
    discover: (source: Source, etag?: string) =>
      read(`csdn/index/${csdnAccount(source)}`, source, etag),
    body: async (source: Source, url: string) => {
      const account = csdnAccount(source);
      const target = new URL(url);
      const id = target.pathname.match(
        new RegExp(`^/${account}/article/details/([0-9]+)/?$`),
      )?.[1];
      if (
        target.origin !== "https://blog.csdn.net" ||
        target.username ||
        target.password ||
        !id
      )
        throw new CrawlError("RSSHub body URL is outside the reviewed account");
      const items = await cached(`csdn/body/${account}/${id}`, source);
      return rssHubBody(items, target.href);
    },
  });
}
