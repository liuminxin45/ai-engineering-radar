import { resolve } from "node:path";
import { loadRegistry } from "../packages/source-registry/index.js";
import { retireReplacedSources } from "../packages/database/retire-sources.js";
import {
  readSnapshot,
  saveSnapshot,
  withSnapshotLock,
} from "../packages/database/snapshot.js";
import {
  indexOfficialArticle,
  INDEX_VERSION,
} from "../packages/classifier/index.js";

const dir = resolve(process.env.RADAR_DATA_DIR ?? ".radar/data");
await withSnapshotLock(dir, async () => {
  const registry = await loadRegistry();
  if (registry.companies.some((c) => c.region !== "cn"))
    throw new Error("Domestic migration requires a domestic-only registry");
  const snapshot = await readSnapshot(dir);
  const companies = new Set(registry.companies.map((c) => c.id));
  const sources = new Map(registry.sources.map((s) => [s.id, s]));
  const retirement = retireReplacedSources(
    snapshot.articles.filter((a) => a.contentType !== "paper"),
    snapshot.states,
    registry,
  );
  const articles = retirement.articles.filter(
    (a) => a.contentType !== "paper" && companies.has(a.companyId),
  );
  let changed =
    articles.length !== snapshot.articles.length ||
    retirement.removedLocations > 0 ||
    retirement.updatedArticles > 0 ||
    retirement.removedStates > 0;
  for (const article of articles) {
    const publisher = registry.publishers.find(
      (p) => p.id === article.publisherId,
    );
    if (!publisher || publisher.companyId !== article.companyId)
      throw new Error(
        `Cannot migrate domestic publisher ${article.publisherId}`,
      );
    const locations = article.locations.filter((l) => {
      const source = sources.get(l.sourceId);
      if (!source) return false;
      if (source.publisherId === article.publisherId) return true;
      const owner = registry.publishers.find(
        (p) => p.id === source.publisherId,
      )?.companyId;
      return (
        article.contentType === "paper" &&
        !!owner &&
        !!article.companyIds?.includes(owner) &&
        !!article.paperAffiliations?.some((p) => p.companyId === owner)
      );
    });
    if (!locations.length)
      throw new Error(
        `Domestic article lost all source relationships: ${article.id}`,
      );
    if (locations.length !== article.locations.length) changed = true;
    article.locations = locations;
    if (article.publicationStatus === "hidden") continue;
    if (
      article.classification.method !== "source" ||
      article.classification.version !== INDEX_VERSION ||
      article.classification.topics.length ||
      article.publicationStatus !== "published"
    ) {
      article.classification = indexOfficialArticle(article);
      article.publicationStatus = "published";
      changed = true;
    }
  }
  const ids = new Set(articles.map((a) => a.id));
  for (const a of articles) {
    const d = a.duplicateCandidates.filter((id) => ids.has(id));
    if (d.length !== a.duplicateCandidates.length) changed = true;
    a.duplicateCandidates = d;
  }
  const states = retirement.states.filter((s) => sources.has(s.sourceId));
  if (states.length !== snapshot.states.length) changed = true;
  if (changed)
    await saveSnapshot(
      dir,
      articles,
      states,
      registry,
      snapshot.bodies?.filter((body) =>
        articles.some(
          (a) =>
            a.id === body.articleId &&
            a.locations.some((l) => l.sourceId === body.sourceId),
        ),
      ),
    );
  console.log(
    `Domestic snapshot: ${articles.length} articles; removed ${retirement.articles.length - articles.length} outside-registry articles, ${retirement.removedArticles} retired-source articles, ${retirement.removedLocations} retired locations and ${snapshot.states.length - states.length} retired source states; ${changed ? "migration applied" : "already current"}.`,
  );
});
