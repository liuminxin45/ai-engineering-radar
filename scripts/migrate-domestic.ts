import { resolve } from "node:path";
import { loadRegistry } from "../packages/source-registry/index.js";
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
  const articles = snapshot.articles.filter((a) => companies.has(a.companyId));
  let changed = articles.length !== snapshot.articles.length;
  for (const article of articles) {
    const publisher = registry.publishers.find(
      (p) => p.id === article.publisherId,
    );
    if (!publisher || publisher.companyId !== article.companyId)
      throw new Error(
        `Cannot migrate domestic publisher ${article.publisherId}`,
      );
    const locations = article.locations.filter(
      (l) => sources.get(l.sourceId)?.publisherId === article.publisherId,
    );
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
  const states = snapshot.states.filter((s) => sources.has(s.sourceId));
  if (states.length !== snapshot.states.length) changed = true;
  if (changed) await saveSnapshot(dir, articles, states, registry);
  console.log(
    `Domestic snapshot: ${articles.length} articles; removed ${snapshot.articles.length - articles.length} overseas articles and ${snapshot.states.length - states.length} retired source states; ${changed ? "migration applied" : "already current"}.`,
  );
});
