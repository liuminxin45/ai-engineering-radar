import { createHash } from "node:crypto";
import type { Article, Candidate, Source } from "../shared/types.js";
import {
  articleContentType,
  contentTypeSchema,
  companyIdsSchema,
  articleSchema,
} from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import { indexOfficialArticle } from "../classifier/index.js";
import { scholarlyUrl } from "./platforms/papers.js";
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
  const suppliedType = item.contentType ?? source.contentType;
  const canonical = normalizeUrl(
    (suppliedType === "paper" && scholarlyUrl(item.canonicalUrl ?? item.url)) ||
      item.canonicalUrl ||
      item.url,
  );
  const url = normalizeUrl(item.url);
  const publisher = registry.publishers.find(
    (p) => p.id === source.publisherId,
  )!;
  if (suppliedType !== undefined) contentTypeSchema.parse(suppliedType);
  const affiliations =
    item.companyIds && companyIdsSchema.parse(item.companyIds);
  if (affiliations?.some((id) => !registry.companies.some((c) => c.id === id)))
    throw new Error("Unknown paper company affiliation");
  if (affiliations && suppliedType === "blog")
    throw new Error("Blog posts cannot have multiple company affiliations");
  const existing = articles.find(
    (a) =>
      (a.publisherId === source.publisherId ||
        (suppliedType === "paper" &&
          a.contentType === "paper" &&
          a.canonicalUrl === canonical)) &&
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
    const contentType = suppliedType ?? articleContentType(existing);
    if (affiliations && contentType !== "paper")
      throw new Error("Company affiliations require paper content type");
    const companyIds =
      contentType === "paper"
        ? existing.publisherId !== source.publisherId || item.paperAffiliations
          ? [
              ...new Set([
                ...(existing.companyIds ?? [existing.companyId]),
                ...(affiliations ?? [publisher.companyId]),
              ]),
            ]
          : (affiliations ?? existing.companyIds ?? [publisher.companyId])
        : undefined;
    const attributionChanged =
      articleContentType(existing) !== contentType ||
      JSON.stringify(existing.companyIds) !== JSON.stringify(companyIds);
    if (suppliedType) existing.contentType = contentType;
    existing.companyIds = companyIds;
    if (item.paperAffiliations) {
      const proofs = [
        ...(existing.paperAffiliations ?? []),
        ...item.paperAffiliations,
      ];
      existing.paperAffiliations = [
        ...new Map(
          proofs
            .filter((p) => companyIds?.includes(p.companyId))
            .map((p) => [`${p.companyId}:${p.evidenceUrl}`, p]),
        ).values(),
      ];
    } else if (contentType !== "paper") existing.paperAffiliations = undefined;
    if (attributionChanged) existing.updatedAt = now;
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
        existing.classification = indexOfficialArticle(item);
        existing.publicationStatus =
          existing.classification.status === "accepted" ? "published" : "draft";
      }
    }
    if (contentType === "paper") articleSchema.parse(existing);
    return existing;
  }
  const classification = indexOfficialArticle(item);
  const contentType = suppliedType ?? "blog";
  if (affiliations && contentType !== "paper")
    throw new Error("Company affiliations require paper content type");
  const id = createHash("sha256")
    .update(
      `${contentType === "paper" ? "paper" : source.publisherId}\n${canonical}`,
    )
    .digest("hex")
    .slice(0, 20);
  const duplicates = articles
    .filter(
      (a) =>
        a.publisherId === source.publisherId &&
        articleContentType(a) === contentType &&
        similar(a.title, item.title),
    )
    .map((a) => a.id);
  const article: Article = {
    id,
    publisherId: source.publisherId,
    companyId: publisher.companyId,
    contentType,
    companyIds:
      contentType === "paper"
        ? (affiliations ?? [publisher.companyId])
        : undefined,
    paperAffiliations: item.paperAffiliations,
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
  if (contentType === "paper") articleSchema.parse(article);
  articles.push(article);
  return article;
}
