import { resolve } from "node:path";
import { loadRegistry } from "../packages/source-registry/index.js";
import { saveSnapshot } from "../packages/database/snapshot.js";
import { upsert } from "../packages/crawler/deduplicate.js";
import type { Article } from "../packages/shared/types.js";
const registry = await loadRegistry();
if (
  !process.env.CI &&
  process.env.RADAR_DATA_DIR &&
  resolve(process.env.RADAR_DATA_DIR) !== resolve(".radar/fixtures")
)
  throw new Error(
    "Fixture generation may only replace .radar/fixtures outside CI",
  );
const articles: Article[] = [];
for (let i = 0; i < 45; i++) {
  const choices = registry.sources.filter(
    (s) => s.crawl.enabled && s.verification.status === "verified",
  );
  const source =
    i % 2
      ? (choices.find((s) => s.publisherId !== "meituan-official") ??
        choices[0])
      : registry.sources.find((s) => s.id === "meituan")!;
  upsert(
    articles,
    {
      title: `${i % 2 ? "Building reliable AI agents" : "AI Coding 工程实践"} ${i + 1}: context pipeline evaluation`,
      url: `${source.entryUrl.replace(/\/$/, "")}/fixture-${i}`,
      externalId: `fixture-${i}`,
      description:
        "We built and evaluated an AI agent architecture with tool calling, context management and a sandbox runtime. 实现代码审查工作流与性能评测。",
      publishedAt: new Date(Date.UTC(2026, 9, 30 - i)).toISOString(),
    },
    source,
    registry,
  );
  // Synthetic titles deliberately resemble one another; fixtures explicitly accept them.
  articles.at(-1)!.classification.status = "accepted";
  articles.at(-1)!.publicationStatus = "published";
  articles.at(-1)!.duplicateCandidates = [];
}
await saveSnapshot(
  resolve(process.env.RADAR_DATA_DIR ?? ".radar/fixtures"),
  articles,
  registry.sources.map((s) => ({
    sourceId: s.id,
    status: s.crawl.enabled ? "success" : "pending",
    discovered: s.crawl.enabled ? 5 : 0,
    consecutiveFailures: 0,
    lastCheckedAt: "2026-11-01T01:00:00.000Z",
    ...(s.crawl.enabled ? { lastSuccessAt: "2026-11-01T01:00:00.000Z" } : {}),
  })),
  registry,
);
console.log("Fixture snapshot written. Synthetic data must never be deployed.");
