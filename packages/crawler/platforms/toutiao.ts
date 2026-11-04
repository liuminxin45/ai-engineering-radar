import * as cheerio from "cheerio";
import { z } from "zod";
import type { Candidate, Source } from "../../shared/types.js";
import { CrawlError } from "../http.js";

const articlePath = /^\/article\/([0-9]{1,30})\/?$/;
const itemSchema = z.object({
  title: z.string().min(1),
  link: z.string().url(),
  author: z.string().optional(),
  pubDate: z.string().optional(),
  description: z.string().optional(),
});
const feedSchema = z.object({
  link: z.string().url(),
  item: z.array(itemSchema).max(100),
});

export function toutiaoAccount(source: Source): string {
  const url = new URL(source.url);
  const token = /^\/c\/user\/token\/([A-Za-z0-9_-]+)\/$/.exec(
    url.pathname,
  )?.[1];
  if (
    source.platform !== "toutiao-account" ||
    source.adapter !== "html" ||
    !source.crawl.enabled ||
    source.verification.status !== "verified" ||
    source.entryUrl !== source.url ||
    url.origin !== "https://www.toutiao.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !token ||
    source.authorAllowlist?.length !== 1 ||
    source.authorAllowlist[0] !== token ||
    source.linkPattern !== "^/article/[0-9]+/?$"
  )
    throw new CrawlError(
      "Toutiao requires a reviewed account token and article path",
    );
  return token;
}

export function reviewedToutiaoUrl(source: Source, value: string): string {
  toutiaoAccount(source);
  const url = new URL(value);
  if (
    url.origin !== "https://www.toutiao.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !articlePath.test(url.pathname)
  )
    throw new CrawlError("Toutiao article URL is outside the reviewed site");
  return `https://www.toutiao.com/article/${articlePath.exec(url.pathname)![1]}/`;
}

export function parseToutiaoFeed(data: unknown, source: Source): Candidate[] {
  const token = toutiaoAccount(source);
  const feed = feedSchema.safeParse(data);
  if (!feed.success || feed.data.link !== source.url)
    throw new CrawlError("Toutiao feed does not identify the reviewed account");
  const candidates = feed.data.item
    .flatMap((item) => {
      let url: string;
      try {
        url = reviewedToutiaoUrl(source, item.link);
      } catch {
        return [];
      }
      if (item.author !== "字节跳动技术团队") return [];
      const published = new Date(item.pubDate || "");
      const description = cheerio
        .load(item.description || "")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      return [
        {
          title: cheerio.load(item.title).text().trim().slice(0, 600),
          url,
          externalId: `${token}:${articlePath.exec(new URL(url).pathname)![1]}`,
          author: item.author,
          description: description.slice(0, 800) || undefined,
          publishedAt:
            Number.isFinite(+published) &&
            published.getUTCFullYear() >= 1990 &&
            +published <= Date.now() + 86400000
              ? published.toISOString()
              : undefined,
        },
      ];
    })
    .filter((item) => item.title);
  if (!candidates.length)
    throw new CrawlError("Toutiao feed contains no reviewed articles");
  return candidates;
}

export function verifyToutiaoDocument(html: string, source: Source): void {
  const token = toutiaoAccount(source);
  const $ = cheerio.load(html);
  const matches = $(".article-content a[href]")
    .toArray()
    .some((element) => {
      const href = $(element).attr("href") || "";
      try {
        const url = new URL(href, "https://www.toutiao.com");
        return (
          url.origin === "https://www.toutiao.com" &&
          url.pathname === `/c/user/token/${token}/` &&
          $(element).text().trim() === "字节跳动技术团队"
        );
      } catch {
        return false;
      }
    });
  if (!matches || !$(".article-content").text().trim())
    throw new CrawlError(
      "Toutiao document has no reviewed author or article body",
    );
}
