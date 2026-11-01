import * as cheerio from "cheerio";
import { z } from "zod";
import type { Candidate, Source } from "../../shared/types.js";
import { allowedHost, CrawlError } from "../http.js";

const identifier = z.string().regex(/^\d{1,30}$/);
const account = z.object({ user_id: identifier, name: z.string() });
const article = z.object({
  content: z.object({
    item_id: identifier,
    user_id: identifier,
    item_type: z.number(),
    status: z.number(),
    name: z.string(),
    abstract: z.string().nullish(),
    publish_time: z.number().nullish(),
  }),
  user: account,
});
const response = z.object({
  loaderData: z.object({
    "user/(id)/layout": z.object({
      userInfo: z.object({ err_no: z.literal(0), data: account }),
    }),
    "user/(id)/page": z.object({
      articleInfo: z.object({
        err_no: z.literal(0),
        data: z.array(z.unknown()),
      }),
    }),
  }),
});

const plain = (value: string, max: number) =>
  cheerio
    .load(`<body>${value}</body>`)
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function publishedAt(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return;
  const millis = seconds * 1000;
  if (millis < Date.UTC(1990, 0, 1) || millis > Date.now() + 86400000) return;
  return new Date(millis).toISOString();
}

/** Only the reviewed account's articleInfo is read; recommendations and bodies are ignored. */
export function parseVolcengineAccount(
  html: string,
  source: Source,
): Candidate[] {
  const entry = new URL(source.entryUrl);
  const endpoint = new URL(source.url);
  const requested = /^\/user\/(\d{1,30})\/?$/.exec(entry.pathname)?.[1];
  if (
    entry.hostname !== "developer.volcengine.com" ||
    endpoint.origin !== entry.origin ||
    endpoint.pathname.replace(/\/$/, "") !==
      entry.pathname.replace(/\/$/, "") ||
    !requested ||
    !source.authorAllowlist?.includes(requested)
  )
    throw new CrawlError(
      "Volcengine entry does not match reviewed account",
      undefined,
      true,
    );

  const $ = cheerio.load(html);
  const routerScript = $("script")
    .toArray()
    .map((el) => $(el).text())
    .map(
      (text) =>
        /^\s*window\._ROUTER_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/.exec(text)?.[1],
    )
    .find(Boolean);
  let parsed: z.infer<typeof response>;
  try {
    parsed = response.parse(JSON.parse(routerScript ?? ""));
  } catch {
    throw new CrawlError("Volcengine account structured listing unavailable");
  }
  const data = parsed.loaderData;
  if (data["user/(id)/layout"].userInfo.data.user_id !== requested)
    throw new CrawlError(
      "Volcengine page belongs to another account",
      undefined,
      true,
    );

  const items = new Map<string, Candidate>();
  for (const raw of data["user/(id)/page"].articleInfo.data) {
    const item = article.safeParse(raw);
    if (!item.success)
      throw new CrawlError("Volcengine article metadata is malformed");
    const { content, user } = item.data;
    if (content.user_id !== requested || user.user_id !== requested) continue;
    if (content.item_type !== 2 || content.status !== 2) continue;
    const url = `https://developer.volcengine.com/articles/${content.item_id}`;
    if (
      !allowedHost(source, url) ||
      (source.linkPattern &&
        !new RegExp(source.linkPattern).test(new URL(url).pathname))
    )
      continue;
    const title = plain(content.name, 600);
    if (!title) continue;
    const summary = content.abstract
      ? plain(content.abstract, 1601)
      : undefined;
    items.set(content.item_id, {
      title,
      url,
      externalId: content.item_id,
      author: plain(user.name, 300) || undefined,
      description:
        summary && summary.length <= 1600 ? summary.slice(0, 800) : undefined,
      publishedAt: publishedAt(content.publish_time),
      language: "zh-CN",
    });
  }
  return [...items.values()];
}
