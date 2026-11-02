import { load } from "cheerio";
import type { Candidate, Source } from "../../shared/types.js";
import { allowedHost, CrawlError } from "../http.js";

const HOST = "developer.ant-ling.com";
const clean = (value: string, limit: number) =>
  value.replace(/\s+/g, " ").trim().slice(0, limit);

function directory(url: string) {
  const u = new URL(url);
  return (
    u.protocol === "https:" &&
    u.hostname === HOST &&
    !u.port &&
    !u.username &&
    !u.password &&
    !u.search &&
    !u.hash &&
    /^\/zh-CN\/blogs\/?$/.test(u.pathname)
  );
}

function publicationDate(value: string): string | undefined {
  const parts = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(value);
  if (!parts) return undefined;
  const [, year, month, day] = parts.map(Number);
  const calendar = new Date(Date.UTC(year!, month! - 1, day));
  if (
    year! < 1990 ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month! - 1 ||
    calendar.getUTCDate() !== day
  )
    return undefined;
  const utc = +calendar - 8 * 60 * 60 * 1000;
  return utc <= Date.now() + 86400000 ? new Date(utc).toISOString() : undefined;
}

/** Official Ling blog cards have an overlay anchor adjacent to metadata. */
export function parseAntLingBlog(html: string, source: Source): Candidate[] {
  if (
    source.platform !== "ant-ling-blog" ||
    !source.authorAllowlist?.includes("ant-ling") ||
    !directory(source.url) ||
    !directory(source.entryUrl)
  )
    throw new CrawlError(
      "Ant Ling source must use the reviewed official directory",
      undefined,
      true,
    );

  const $ = load(html);
  const items = new Map<string, Candidate>();
  for (const element of $("div.group > a[aria-label][href]").toArray()) {
    const anchor = $(element);
    if (anchor.closest("nav, header, footer").length) continue;
    const card = anchor.parent("div.group");
    let url: URL;
    try {
      url = new URL(anchor.attr("href")!, source.url);
    } catch {
      continue;
    }
    const slug = /^\/zh-CN\/blogs\/([a-z0-9][a-z0-9.-]*)\/?$/.exec(
      url.pathname,
    )?.[1];
    if (
      url.protocol !== "https:" ||
      url.hostname !== HOST ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !slug ||
      !allowedHost(source, url.href)
    )
      continue;

    const headings = card.find("h2");
    const title = clean(headings.first().text(), 600);
    if (
      headings.length !== 1 ||
      !title ||
      !clean(anchor.attr("aria-label") ?? "", 600)
    )
      throw new CrawlError("Ant Ling blog card metadata changed");
    const date = card
      .find("span")
      .toArray()
      .map((e) => clean($(e).text(), 40))
      .find((value) => /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(value));
    items.set(slug, {
      title,
      url: `https://${HOST}/zh-CN/blogs/${slug}`,
      externalId: slug,
      author: "蚂蚁百灵",
      description: clean(card.find("p").first().text(), 800) || undefined,
      publishedAt: date ? publicationDate(date) : undefined,
      language: "zh-CN",
    });
  }
  if (!items.size)
    throw new CrawlError("Ant Ling blog directory has no valid article cards");
  return [...items.values()];
}
