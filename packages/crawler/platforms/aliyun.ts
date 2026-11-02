import * as cheerio from "cheerio";
import type { Candidate, Source } from "../../shared/types.js";
import { allowedHost, CrawlError } from "../http.js";

const HOST = "developer.aliyun.com";

function groupUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== HOST ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/group\/[a-z0-9_-]+(?:\/article)?\/?$/i.test(url.pathname)
  )
    throw new CrawlError(
      "Aliyun source must use a reviewed official group",
      undefined,
      true,
    );
  return url;
}

function reviewedGroup(source: Source) {
  const url = groupUrl(source.url);
  const entry = groupUrl(source.entryUrl);
  if (url.pathname.replace(/\/$/, "") !== entry.pathname.replace(/\/$/, ""))
    throw new CrawlError(
      "Aliyun group does not match reviewed entry",
      undefined,
      true,
    );
  const accounts = source.authorAllowlist;
  if (!accounts?.length || accounts.some((id) => !/^[a-z0-9_-]+$/i.test(id)))
    throw new CrawlError(
      "Aliyun group requires reviewed profile IDs",
      undefined,
      true,
    );
  return { url, accounts };
}

function publisherId(value: string | undefined, base: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== HOST ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    return url.pathname.match(/^\/profile\/([a-z0-9_-]+)\/?$/i)?.[1];
  } catch {
    return undefined;
  }
}

/** Group listings expose a publication date in China Standard Time. */
function publishedAt(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return undefined;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const calendar = new Date(Date.UTC(+year, +month - 1, +day));
  if (
    calendar.getUTCFullYear() !== +year ||
    calendar.getUTCMonth() !== +month - 1 ||
    calendar.getUTCDate() !== +day ||
    +year < 1990 ||
    +hour > 23 ||
    +minute > 59 ||
    +second > 59
  )
    return undefined;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`,
  );
  return Number.isFinite(+date) && +date <= Date.now() + 86400000
    ? date.toISOString()
    : undefined;
}

function reviewedProfile(source: Source) {
  const entry = new URL(source.entryUrl);
  const url = new URL(source.url);
  const id = entry.pathname.match(/^\/profile\/([a-z0-9]{8,64})$/)?.[1];
  if (
    entry.origin !== `https://${HOST}` ||
    entry.search ||
    entry.hash ||
    entry.username ||
    entry.password ||
    !id ||
    source.authorAllowlist?.length !== 1 ||
    source.authorAllowlist[0] !== id ||
    url.origin !== entry.origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== entry.pathname &&
      !new RegExp(`^/profile/expert/${id}/news_[1-9][0-9]*$`).test(
        url.pathname,
      ))
  )
    throw new CrawlError(
      "Aliyun profile must match the reviewed account",
      undefined,
      true,
    );
  return { url, id };
}

/** The profile activity feed also contains likes and comments: collect publication rows only. */
export function parseAliyunProfile(html: string, source: Source): Candidate[] {
  const { url, id } = reviewedProfile(source);
  const $ = cheerio.load(html);
  const identities = $("script:not([src])")
    .toArray()
    .flatMap((el) =>
      [
        ...$(el)
          .text()
          .matchAll(/["']uccId["']\s*:\s*["']([a-z0-9]+)["']/g),
      ].map((m) => m[1]),
    );
  if (!identities.length || identities.some((v) => v !== id))
    throw new CrawlError(
      !identities.length && /x5referer|login\.m\.taobao\.com/.test(html)
        ? "Aliyun profile requires login or access verification"
        : "Aliyun profile identity is missing or mismatched",
      undefined,
      !identities.length && /x5referer|login\.m\.taobao\.com/.test(html),
    );
  const items = new Map<string, Candidate>();
  $("ul.news-list > li.news-item").each((_, element) => {
    const row = $(element);
    if (row.find(".dynamic-text").text().replace(/\s+/g, "") !== "发表了文章")
      return;
    const heading = row.find(".dynamic-title > a");
    if (heading.length !== 1) return;
    let article: URL;
    try {
      article = new URL(heading.attr("href") ?? "", url);
    } catch {
      return;
    }
    const articleId = article.pathname.match(/^\/article\/([0-9]+)\/?$/)?.[1];
    if (
      !articleId ||
      article.origin !== url.origin ||
      article.username ||
      article.password ||
      row.attr("data-object-id") !== articleId
    )
      return;
    const title = heading.text().replace(/\s+/g, " ").trim().slice(0, 600);
    if (!title) return;
    const summary = row
      .find(".dynamic-summary")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    items.set(articleId, {
      title,
      url: `${url.origin}/article/${articleId}`,
      externalId: articleId,
      author: source.name.split(" · ")[0],
      description:
        summary && summary.length <= 1600 ? summary.slice(0, 800) : undefined,
      publishedAt: publishedAt(row.attr("data-time") ?? ""),
      language: "zh-CN",
    });
  });
  return [...items.values()];
}

export function nextAliyunProfilePage(
  html: string,
  source: Source,
): string | undefined {
  const { url, id } = reviewedProfile(source);
  const current = Number(url.pathname.match(/\/news_([0-9]+)$/)?.[1] ?? 1);
  if (current >= 1000) return;
  const target = `${url.origin}/profile/expert/${id}/news_${current + 1}`;
  const $ = cheerio.load(html);
  return $("a[href]")
    .toArray()
    .some((e) => {
      try {
        return new URL($(e).attr("href")!, url).href === target;
      } catch {
        return false;
      }
    })
    ? target
    : undefined;
}

/** Only the current group's article rows can establish an article's publisher. */
export function parseAliyunGroup(html: string, source: Source): Candidate[] {
  const { url, accounts } = reviewedGroup(source);
  const $ = cheerio.load(html);
  const items = new Map<string, Candidate>();
  $("#article .content-tab-list.all-list > li.all-list-box").each(
    (_, element) => {
      const message = $(element).children(".news-message");
      if (message.length !== 1) return;
      const author = message.children("p").children("a.user");
      if (author.length !== 1) return;
      const account = publisherId(author.attr("href"), url.href);
      if (!account || !accounts.includes(account)) return;
      const heading = message
        .children("a")
        .filter((_, a) => $(a).children("h3").length === 1);
      if (heading.length !== 1) return;
      let article: URL;
      try {
        article = new URL(heading.attr("href") ?? "", url.href);
      } catch {
        return;
      }
      const id = article.pathname.match(/^\/article\/(\d+)\/?$/)?.[1];
      if (
        !id ||
        article.protocol !== "https:" ||
        article.hostname !== HOST ||
        article.username ||
        article.password ||
        article.port ||
        !allowedHost(source, article.href) ||
        (source.linkPattern &&
          !new RegExp(source.linkPattern).test(article.pathname))
      )
        return;
      const title = heading
        .children("h3")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);
      if (!title) return;
      items.set(id, {
        title,
        url: `https://${HOST}/article/${id}`,
        externalId: id,
        author:
          author.text().replace(/\s+/g, " ").trim().slice(0, 300) || account,
        publishedAt: publishedAt(
          message.children("p").children(".time").text(),
        ),
        language: "zh-CN",
      });
    },
  );
  return [...items.values()];
}

/** Follow only the next numbered public page of this exact reviewed group. */
export function nextAliyunPage(
  html: string,
  source: Source,
): string | undefined {
  const { url } = reviewedGroup(source);
  const current = Number(url.searchParams.get("pageNum") ?? "1");
  if (!Number.isSafeInteger(current) || current < 1 || current >= 1000)
    return undefined;
  const $ = cheerio.load(html);
  for (const a of $("a[href]").toArray()) {
    let next: URL;
    try {
      next = new URL($(a).attr("href")!, url.href);
    } catch {
      continue;
    }
    if (
      next.origin === url.origin &&
      !next.username &&
      !next.password &&
      next.pathname.replace(/\/$/, "") === url.pathname.replace(/\/$/, "") &&
      next.searchParams.get("pageNum") === String(current + 1)
    ) {
      const target = new URL(url.pathname, url.origin);
      target.searchParams.set("pageNum", String(current + 1));
      return target.href;
    }
  }
  return undefined;
}
