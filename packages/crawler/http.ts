import robotsParserImport from "robots-parser";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Source } from "../shared/types.js";
export const USER_AGENT =
  "AIEngineeringRadar/0.1 (+https://github.com/liuminxin45/ai-engineering-radar)";
interface RobotPolicy {
  isAllowed(url: string, agent?: string): boolean | undefined;
  getCrawlDelay(agent?: string): number | undefined;
}
const robotsParser = robotsParserImport as unknown as (
  url: string,
  content: string,
) => RobotPolicy;
export class CrawlError extends Error {
  constructor(
    message: string,
    public status?: number,
    public blocked = false,
  ) {
    super(message);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function isPublicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const a = ip.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0] >= 224 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && a[1] === 168) ||
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
      (a[0] === 198 && (a[1] === 18 || a[1] === 19))
    );
  }
  if (isIP(ip) === 6) return /^(2|3)[0-9a-f]{0,3}:/i.test(ip);
  return false;
}
export async function assertPublicUrl(input: string) {
  const u = new URL(input);
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new CrawlError("Unsupported public URL", undefined, true);
  const addresses = await lookup(u.hostname.replace(/^\[|\]$/g, ""), {
    all: true,
  });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new CrawlError(
      "Non-public network address rejected",
      undefined,
      true,
    );
}
export interface HttpResult {
  status: number;
  text: string;
  etag?: string;
  lastModified?: string;
  url: string;
}
const queues = new Map<string, Promise<unknown>>();
const domainSpacing = new Map<string, number>();
async function serial<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prior = queues.get(host) ?? Promise.resolve();
  const task = prior.catch(() => {}).then(fn);
  queues.set(
    host,
    task.then(
      () => sleep(domainSpacing.get(host) ?? 400),
      () => sleep(domainSpacing.get(host) ?? 400),
    ),
  );
  return task;
}
const robots = new Map<string, Promise<ReturnType<typeof robotsParser>>>();
export function allowedHost(source: Source, url: string) {
  const hosts = [
    new URL(source.url).hostname,
    new URL(source.entryUrl).hostname,
    ...(source.linkHosts ?? []),
  ];
  return hosts.includes(new URL(url).hostname);
}
async function rawFetch(
  url: string,
  source: Source,
  headers: Record<string, string> = {},
  beforeRedirect?: (url: string) => Promise<void>,
): Promise<HttpResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let current = url;
      for (let redirects = 0; redirects <= 5; redirects++) {
        if (!allowedHost(source, current))
          throw new CrawlError(
            "Redirect outside reviewed source hosts",
            undefined,
            true,
          );
        await assertPublicUrl(current);
        const result = await serial(new URL(current).hostname, async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          try {
            const response = await fetch(current, {
              headers: {
                "User-Agent": USER_AGENT,
                Accept:
                  "application/atom+xml, application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.5",
                ...headers,
              },
              redirect: "manual",
              signal: controller.signal,
            });
            const location = response.headers.get("location");
            if (
              response.status >= 300 &&
              response.status < 400 &&
              response.status !== 304 &&
              location
            ) {
              await response.body?.cancel();
              return { redirect: new URL(location, current).href };
            }
            if (response.status === 429 || response.status >= 500) {
              await response.body?.cancel();
              throw new CrawlError(
                `HTTP ${response.status}: source temporarily unavailable`,
                response.status,
              );
            }
            const chunks: Uint8Array[] = [];
            let size = 0;
            if (response.body)
              for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
                size += chunk.length;
                if (size > 8 * 1024 * 1024) {
                  controller.abort();
                  throw new CrawlError("Response exceeds 8 MiB limit");
                }
                chunks.push(chunk);
              }
            return {
              result: {
                status: response.status,
                text: Buffer.concat(chunks).toString("utf8"),
                etag: response.headers.get("etag") ?? undefined,
                lastModified:
                  response.headers.get("last-modified") ?? undefined,
                url: current,
              },
            };
          } finally {
            clearTimeout(timeout);
          }
        });
        if ("redirect" in result && result.redirect) {
          if (beforeRedirect) await beforeRedirect(result.redirect);
          current = result.redirect;
          continue;
        }
        if ("result" in result && result.result) return result.result;
      }
      throw new CrawlError("Too many redirects");
    } catch (error) {
      if (error instanceof CrawlError && error.blocked) throw error;
      if (attempt === 2) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new CrawlError("Request failed");
}
export async function fetchReviewed(
  url: string,
  source: Source,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  const origin = new URL(url).origin;
  if (!robots.has(origin))
    robots.set(
      origin,
      (async () => {
        const result = await rawFetch(`${origin}/robots.txt`, source);
        if (result.status === 401 || result.status === 403)
          throw new CrawlError("robots.txt access denied", result.status, true);
        if (
          result.status !== 200 &&
          result.status !== 404 &&
          result.status !== 410
        )
          throw new CrawlError(
            `robots.txt HTTP ${result.status}`,
            result.status,
          );
        return robotsParser(
          `${origin}/robots.txt`,
          result.status === 200 ? result.text : "",
        );
      })(),
    );
  const policy = await robots.get(origin)!;
  if (policy.isAllowed(url, "AIEngineeringRadar") === false)
    throw new CrawlError("robots.txt disallows this path", undefined, true);
  const delay = policy.getCrawlDelay("AIEngineeringRadar");
  if (delay && delay > 60)
    throw new CrawlError(
      "robots.txt crawl-delay exceeds supported run budget",
      undefined,
      true,
    );
  if (delay && delay > 0)
    domainSpacing.set(new URL(url).hostname, Math.max(400, delay * 1000));
  const result = await rawFetch(url, source, headers, async (target) => {
    if (new URL(target).origin !== origin)
      throw new CrawlError(
        "Cross-origin redirect requires an explicit source entry",
        undefined,
        true,
      );
    if (policy.isAllowed(target, "AIEngineeringRadar") === false)
      throw new CrawlError(
        "Redirect target blocked by robots.txt",
        undefined,
        true,
      );
  });
  if (result.status === 401 || result.status === 403)
    throw new CrawlError(
      `HTTP ${result.status}: access restricted`,
      result.status,
      true,
    );
  if (result.status !== 200 && result.status !== 304)
    throw new CrawlError(`HTTP ${result.status}`, result.status);
  // A redirected destination must also allow crawling.
  if (result.url !== url) {
    const targetOrigin = new URL(result.url).origin;
    if (targetOrigin !== origin)
      throw new CrawlError(
        "Cross-origin redirect requires an explicit source entry",
        result.status,
        true,
      );
    if (policy.isAllowed(result.url, "AIEngineeringRadar") === false)
      throw new CrawlError(
        "Redirect target blocked by robots.txt",
        undefined,
        true,
      );
  }
  return result;
}
