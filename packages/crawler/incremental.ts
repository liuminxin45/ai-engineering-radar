import { createHash } from "node:crypto";
import type { Article, Candidate, Source } from "../shared/types.js";
import { normalizeUrl } from "./deduplicate.js";

export interface CollectionOptions {
  incremental?: boolean;
  knownArticles?: Article[];
}
export function knownArticle(
  item: Candidate,
  source: Source,
  articles: Article[],
) {
  const url = normalizeUrl(item.url);
  const canonical = normalizeUrl(item.canonicalUrl ?? item.url);
  return articles.find(
    (article) =>
      (article.publisherId === source.publisherId ||
        ((item.contentType ?? source.contentType) === "paper" &&
          article.contentType === "paper")) &&
      (article.canonicalUrl === canonical ||
        article.locations.some(
          (location) =>
            location.sourceId === source.id &&
            ((item.externalId && location.externalId === item.externalId) ||
              normalizeUrl(location.url) === url),
        )),
  );
}
export function listingHash(item: Candidate) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        item.title,
        normalizeUrl(item.url),
        item.canonicalUrl && normalizeUrl(item.canonicalUrl),
        item.author,
        item.description,
        item.publishedAt,
        item.language,
        item.contentType,
        item.companyIds && [...item.companyIds].sort(),
        item.paperAffiliations,
      ]),
    )
    .digest("hex");
}
export function prepareCandidate(
  item: Candidate,
  source: Source,
  options: CollectionOptions,
) {
  delete item.unchanged;
  item.listingHash = listingHash(item);
  if (!options.incremental) return;
  const previous = knownArticle(item, source, options.knownArticles ?? []);
  const location = previous?.locations.find(
    (location) =>
      location.sourceId === source.id &&
      ((item.externalId && location.externalId === item.externalId) ||
        normalizeUrl(location.url) === normalizeUrl(item.url)),
  );
  if (!previous || !location || location.metadataPending) return;
  // Legacy snapshots have no listing hash. Establish a baseline without fetching
  // detail pages when all metadata supplied by the listing already agrees.
  item.unchanged = location.listingHash
    ? location.listingHash === item.listingHash
    : item.title === previous.title &&
      (!item.description || item.description === previous.description) &&
      (!item.author || item.author === previous.author) &&
      (!item.publishedAt || item.publishedAt === previous.publishedAt) &&
      (!item.language || item.language === previous.language) &&
      (!item.contentType || item.contentType === previous.contentType) &&
      (!item.companyIds ||
        JSON.stringify([...item.companyIds].sort()) ===
          JSON.stringify([...(previous.companyIds ?? [])].sort()));
}
