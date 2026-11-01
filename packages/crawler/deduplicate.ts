import { createHash } from "node:crypto";
import type { Article, Candidate, Source } from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import { classifyRules } from "../classifier/index.js";
export function normalizeUrl(input: string) {
  const u = new URL(input);
  if (!["https:", "http:"].includes(u.protocol))
    throw new Error("Invalid article URL");
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (
      /^utm_/i.test(key) ||
      ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key)
    )
      u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, "");
  return u.href;
}
const fingerprint = (s: string) =>
  s.toLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
export function similar(a: string, b: string) {
  a = fingerprint(a);
  b = fingerprint(b);
  if (a.length < 12 || b.length < 12) return a === b;
  const grams = (s: string) =>
    new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const aa = grams(a),
    bb = grams(b);
  const common = [...aa].filter((s) => bb.has(s)).length;
  return (2 * common) / (aa.size + bb.size) >= 0.86;
}
export function upsert(
  articles: Article[],
  item: Candidate,
  source: Source,
  registry: Registry,
  now = new Date().toISOString(),
) {
  const canonical = normalizeUrl(item.canonicalUrl ?? item.url);
  const url = normalizeUrl(item.url);
  const publisher = registry.publishers.find(
    (p) => p.id === source.publisherId,
  )!;
  const existing = articles.find(
    (a) =>
      a.publisherId === source.publisherId &&
      (a.canonicalUrl === canonical ||
        a.locations.some(
          (l) =>
            (l.sourceId === source.id &&
              item.externalId &&
              l.externalId === item.externalId) ||
            normalizeUrl(l.url) === url,
        )),
  );
  if (existing) {
    const location = existing.locations.find(
      (l) =>
        l.sourceId === source.id &&
        ((item.externalId && l.externalId === item.externalId) ||
          normalizeUrl(l.url) === url),
    );
    if (!location)
      existing.locations.push({
        sourceId: source.id,
        externalId: item.externalId,
        url,
      });
    else if (location.url !== url) {
      if (existing.canonicalUrl === normalizeUrl(location.url))
        existing.canonicalUrl = canonical;
      location.url = url;
      existing.updatedAt = now;
    }
    const metadataChanged =
      existing.title !== item.title ||
      (!!item.description && existing.description !== item.description);
    existing.title = item.title;
    if (item.description) existing.description = item.description;
    if (item.author) existing.author = item.author;
    if (item.publishedAt) existing.publishedAt = item.publishedAt;
    if (item.language) existing.language = item.language;
    if (metadataChanged) {
      existing.updatedAt = now;
      if (existing.classification.method !== "manual") {
        existing.classification = classifyRules(item);
        existing.publicationStatus =
          existing.classification.status === "accepted" ? "published" : "draft";
      }
    }
    return existing;
  }
  const classification = classifyRules(item);
  const id = createHash("sha256")
    .update(`${source.publisherId}\n${canonical}`)
    .digest("hex")
    .slice(0, 20);
  const duplicates = articles
    .filter(
      (a) =>
        a.publisherId === source.publisherId && similar(a.title, item.title),
    )
    .map((a) => a.id);
  if (duplicates.length) {
    classification.status = "review";
    classification.reason =
      "发现相似标题，但缺少确定的跨平台原文关系，等待人工确认。";
  }
  const article: Article = {
    id,
    publisherId: source.publisherId,
    companyId: publisher.companyId,
    title: item.title,
    canonicalUrl: canonical,
    author: item.author,
    description: item.description,
    language: item.language,
    publishedAt: item.publishedAt,
    discoveredAt: now,
    updatedAt: now,
    classification,
    publicationStatus:
      classification.status === "accepted" ? "published" : "draft",
    locations: [{ sourceId: source.id, externalId: item.externalId, url }],
    duplicateCandidates: duplicates,
  };
  articles.push(article);
  return article;
}
