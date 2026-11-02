import type { Article, SourceState } from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import {
  sourceReplacements,
  sourceWithdrawals,
  validateSourceReplacements,
} from "../source-registry/replacements.js";

export function retireReplacedSources(
  articles: Article[],
  states: SourceState[],
  registry: Registry,
) {
  validateSourceReplacements(registry);
  const retired = new Set<string>(
    [...sourceReplacements, ...sourceWithdrawals].map((r) => r.sourceId),
  );
  for (const rule of sourceReplacements) {
    const present =
      states.some((s) => s.sourceId === rule.sourceId) ||
      articles.some((a) =>
        a.locations.some((l) => l.sourceId === rule.sourceId),
      );
    if (!present) continue;
    if ("referenceOnly" in rule && rule.referenceOnly) {
      if (
        articles.some((a) =>
          a.locations.some((l) => l.sourceId === rule.sourceId),
        )
      )
        throw new Error(
          `Reference-only retirement contains article history: ${rule.sourceId}`,
        );
      continue;
    }
    for (const id of rule.replacementIds) {
      const source = registry.sources.find((s) => s.id === id)!;
      if (!source.crawl.enabled || source.verification.status !== "verified")
        throw new Error(`Replacement must be verified and enabled: ${id}`);
      const evidence = articles.some(
        (a) =>
          a.publisherId === source.publisherId &&
          a.companyId === rule.companyId &&
          a.publicationStatus === "published" &&
          a.classification.status === "accepted" &&
          a.locations.some((l) => l.sourceId === id),
      );
      if (
        !states.some((s) => s.sourceId === id && s.lastSuccessAt) ||
        !evidence
      )
        throw new Error(
          `Replacement has no successful collected article: ${id}`,
        );
    }
  }
  const withdrawnCompanies = new Set<string>(
    sourceWithdrawals
      .filter((rule) => !("sourceOnly" in rule && rule.sourceOnly))
      .map((rule) => rule.companyId),
  );
  let updatedArticles = 0;
  const retained = articles.flatMap((a) => {
    const locations = a.locations.filter((l) => !retired.has(l.sourceId));
    if (!locations.length) return [];
    const article = { ...a, locations };
    if (a.contentType === "paper") {
      article.companyIds = a.companyIds?.filter(
        (id) => !withdrawnCompanies.has(id),
      );
      article.paperAffiliations = a.paperAffiliations?.filter(
        (proof) => !withdrawnCompanies.has(proof.companyId),
      );
      if (withdrawnCompanies.has(a.companyId)) {
        const publisher = locations.flatMap((location) => {
          const source = registry.sources.find(
            (s) => s.id === location.sourceId,
          );
          const owner = registry.publishers.find(
            (p) => p.id === source?.publisherId,
          );
          return source?.contentType === "paper" &&
            source.crawl.enabled &&
            source.verification.status === "verified" &&
            owner &&
            article.companyIds?.includes(owner.companyId) &&
            article.paperAffiliations?.some(
              (proof) => proof.companyId === owner.companyId,
            )
            ? [owner]
            : [];
        })[0];
        if (!publisher)
          throw new Error(
            `Withdrawn paper has no verified retained publisher: ${a.id}`,
          );
        article.publisherId = publisher.id;
        article.companyId = publisher.companyId;
      }
      if (
        article.companyId !== a.companyId ||
        article.companyIds?.length !== a.companyIds?.length ||
        article.paperAffiliations?.length !== a.paperAffiliations?.length
      )
        updatedArticles++;
    }
    return [article];
  });
  const ids = new Set(retained.map((a) => a.id));
  const removedIds = new Set(
    articles.filter((a) => !ids.has(a.id)).map((a) => a.id),
  );
  for (const a of retained)
    a.duplicateCandidates = a.duplicateCandidates.filter(
      (id) => !removedIds.has(id),
    );
  const retainedStates = states.filter((s) => !retired.has(s.sourceId));
  const removedLocations = articles.reduce(
    (n, a) => n + a.locations.filter((l) => retired.has(l.sourceId)).length,
    0,
  );
  return {
    articles: retained,
    states: retainedStates,
    removedLocations,
    removedArticles: articles.length - retained.length,
    removedStates: states.length - retainedStates.length,
    updatedArticles,
  };
}
