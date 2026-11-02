import { load } from "cheerio";
import type { Candidate, Source } from "../../shared/types.js";
import { CrawlError, fetchReviewed, type HttpResult } from "../http.js";

const ORIGIN = "https://mimo.xiaomi.com";
const CDN_ASSETS =
  "https://cdn.cnbj1.fds.api.mi-img.com/aife/mimo-blog-fe/doc_build/static/js/";
const ASSETS = `${ORIGIN}/static/js/`;
const literal = '"(?:[^"\\\\]|\\\\.)*"';
const clean = (s: string, limit: number) =>
  s.replace(/\s+/g, " ").trim().slice(0, limit);

export function validateMiMoSource(source: Source) {
  if (
    source.platform !== "xiaomi-mimo" ||
    source.adapter !== "html" ||
    source.entryUrl !== `${ORIGIN}/` ||
    source.url !== `${ORIGIN}/zh/` ||
    source.authorAllowlist?.length !== 1 ||
    source.authorAllowlist[0] !== "xiaomi-mimo" ||
    source.linkHosts?.length
  )
    throw new CrawlError(
      "MiMo requires the reviewed official homepage and assets",
      undefined,
      true,
    );
}

export function miMoScripts(html: string): { runtime: string; routes: string } {
  const $ = load(html);
  const scripts = $("script[src]")
    .map((_, e) => $(e).attr("src")!)
    .get()
    // The official site serves identical assets at its own public static path.
    // Keep collection on that origin, whose robots policy is checked normally.
    .map((s) =>
      s.startsWith(CDN_ASSETS) ? ASSETS + s.slice(CDN_ASSETS.length) : s,
    );
  const runtime = scripts.find(
    (s) =>
      s.startsWith(ASSETS) &&
      /^index\.[a-f0-9]+\.js$/.test(s.slice(ASSETS.length)),
  );
  const routes = scripts.find(
    (s) =>
      s.startsWith(ASSETS) &&
      /^\d+\.[a-f0-9]+\.js$/.test(s.slice(ASSETS.length)),
  );
  if (!runtime || !routes)
    throw new CrawlError("MiMo homepage script references changed");
  return { runtime, routes };
}

export function miMoHomeScript(runtime: string, routes: string): string {
  const route =
    /path:"\/zh\/",[^;]*?filePath:"zh\/index\.mdx",preload:([\s\S]*?),lang:"zh"/.exec(
      routes,
    )?.[1];
  const id = route
    ? [...route.matchAll(/\.e\("(\d+)"\)/g)].at(-1)?.[1]
    : undefined;
  const hash = id
    ? new RegExp(`(?:[,{])${id}:"([a-f0-9]+)"`).exec(runtime)?.[1]
    : undefined;
  if (!id || !hash || !runtime.includes('"static/js/async/"'))
    throw new CrawlError("MiMo Chinese homepage chunk mapping changed");
  return `${ASSETS}async/${id}.${hash}.js`;
}

function articleUrl(link: string): string | undefined {
  const path = link.startsWith("/blog/") ? `/zh${link}` : link;
  const u = new URL(path, ORIGIN);
  if (
    u.origin !== ORIGIN ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/^\/(?:zh\/blog\/[a-z0-9-]+|mimo-[a-z0-9-]+(?:\/(?:index(?:-zh)?|article)\.html)?)$/.test(
      u.pathname,
    )
  )
    return;
  return u.href;
}

/** Read string literals as data, never execute the publisher's JavaScript. */
export function parseMiMoListing(
  html: string,
  script: string,
  source: Source,
): Candidate[] {
  validateMiMoSource(source);
  const section =
    /sectionTitle:"博客",initialVisibleCount:\d+,blogs:\[([\s\S]*?)\]\}/.exec(
      script,
    )?.[1];
  if (!section)
    throw new CrawlError("MiMo blog list unavailable in homepage chunk");
  const pattern = new RegExp(
    `\\{title:(${literal}),link:(${literal}),desc:(${literal})\\}`,
    "g",
  );
  const items: Candidate[] = [];
  for (const match of section.matchAll(pattern)) {
    const [title, link, description] = match
      .slice(1)
      .map((s) => JSON.parse(s) as string);
    const url = articleUrl(link);
    if (!url || !clean(title, 600))
      throw new CrawlError("MiMo blog entry location or title changed");
    items.push({
      title: clean(title, 600),
      url,
      externalId: new URL(url).pathname,
      description: clean(description, 800) || undefined,
      author: "Xiaomi MiMo Team",
    });
  }
  const $ = load(html);
  const titles = $("#blog h3")
    .map((_, e) => clean($(e).text(), 600))
    .get();
  if (
    !items.length ||
    titles.length !== items.length ||
    titles.some((title, i) => title !== items[i].title) ||
    new Set(items.map((i) => i.url)).size !== items.length
  )
    throw new CrawlError("MiMo homepage and blog chunk metadata do not match");
  return items;
}

export function parseMiMoMetadata(html: string): Partial<Candidate> {
  const $ = load(html);
  const time = $("time.hero-date").first();
  const visible = clean(time.text(), 100);
  const chinese = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/.exec(
    visible,
  );
  const english =
    /^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(?:st|nd|rd|th)?, (\d{4})$/.exec(
      visible,
    );
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const full = /^\d{4}-\d{2}-\d{2}$/.test(time.attr("datetime") ?? "")
    ? time.attr("datetime")
    : undefined;
  const value =
    full ??
    (chinese
      ? `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`
      : english
        ? `${english[3]}-${String(months.indexOf(english[1]) + 1).padStart(2, "0")}-${english[2].padStart(2, "0")}`
        : undefined);
  let publishedAt: string | undefined;
  if (value) {
    const d = new Date(`${value}T00:00:00Z`);
    if (
      Number.isFinite(+d) &&
      d.toISOString().slice(0, 10) === value &&
      d.getUTCFullYear() >= 1990 &&
      +d <= Date.now() + 86400000
    )
      publishedAt = new Date(+d - 8 * 3600000).toISOString();
  }
  return { publishedAt, language: $("html").attr("lang") || undefined };
}

export function miMoArticleFrame(
  html: string,
  url: string,
): string | undefined {
  const $ = load(html);
  // Only a wrapper without its own heading may provide the article via iframe.
  if ($("h1").length) return;
  const frames = $("iframe[src]")
    .map((_, e) => new URL($(e).attr("src")!, url))
    .get()
    .filter(
      (u) =>
        u.origin === ORIGIN &&
        !u.search &&
        !u.hash &&
        !u.username &&
        !u.password &&
        /^\/mimo-[a-z0-9-]+\/(?:zh|index(?:-zh)?|article)\.html$/.test(
          u.pathname,
        ),
    );
  return frames.length === 1 ? frames[0].href : undefined;
}

export async function collectMiMo(
  source: Source,
  response: HttpResult,
  limit: number,
) {
  validateMiMoSource(source);
  const scripts = miMoScripts(response.text);
  const runtime = await fetchReviewed(scripts.runtime, source);
  const routes = await fetchReviewed(scripts.routes, source);
  const home = await fetchReviewed(
    miMoHomeScript(runtime.text, routes.text),
    source,
  );
  const items = parseMiMoListing(response.text, home.text, source).slice(
    0,
    limit,
  );
  const warnings: string[] = [];
  for (const item of items) {
    try {
      const page = await fetchReviewed(item.url, source);
      const frame = miMoArticleFrame(page.text, item.url);
      const html = frame
        ? (await fetchReviewed(frame, source)).text
        : page.text;
      if (!load(html)("h1").length)
        throw new CrawlError("MiMo article metadata unavailable");
      Object.assign(item, parseMiMoMetadata(html));
    } catch (error) {
      warnings.push(
        error instanceof CrawlError
          ? error.message
          : "MiMo article metadata request failed",
      );
    }
  }
  return { items, response, warnings };
}
