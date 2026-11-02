import type { Source } from "../../shared/types.js";
import { CrawlError } from "../http.js";
export function csdnAccount(source: Source) {
  const url = new URL(source.url);
  const account = url.pathname.match(/^\/([A-Za-z0-9_]+)\/rss\/map$/)?.[1];
  if (
    source.platform !== "csdn-feed" ||
    !source.crawl.enabled ||
    source.verification.status !== "verified" ||
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
    throw new CrawlError("CSDN requires a reviewed account and article path");
  return account;
}
export function reviewedCsdnUrl(source: Source, value: string) {
  const account = csdnAccount(source);
  const url = new URL(value);
  if (
    url.origin !== "https://blog.csdn.net" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !new RegExp(`^/${account}/article/details/[0-9]+/?$`).test(url.pathname)
  )
    throw new CrawlError("CSDN article URL is outside the reviewed account");
  return url.href.replace(/\/$/, "");
}
