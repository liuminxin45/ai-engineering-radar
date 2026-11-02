import { resolve } from "node:path";
import { loadRegistry } from "../packages/source-registry/index.js";
import { saveSnapshot } from "../packages/database/snapshot.js";
import { upsert } from "../packages/crawler/deduplicate.js";
import type { Article } from "../packages/shared/types.js";
import {
  articleParser,
  ENGINE_VERSION,
} from "../packages/article-parser/index.js";
import { articleBodySchema } from "../packages/shared/article-body.js";
import { digest } from "../packages/database/snapshot.js";
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
      title:
        i === 0
          ? "Visa持卡人请查收！你的专属Token福利来了！"
          : `${i % 2 ? "Building reliable AI agents" : "AI Coding 工程实践"} ${i + 1}: context pipeline evaluation`,
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
const bodyFixtures = articles
  .filter((article) => article.contentType !== "paper")
  .map((article, index) => {
    const checkedAt = "2026-11-02T00:00:00.000Z";
    if (index === 44)
      return articleBodySchema.parse({
        articleId: article.id,
        status: "unavailable",
        sourceId: article.locations[0].sourceId,
        sourceUrl: article.canonicalUrl,
        engineVersion: ENGINE_VERSION,
        checkedAt,
        error: "Fixture unavailable",
      });
    const parsed = articleParser.parse({
      url: article.canonicalUrl,
      fragment: true,
      content: `<h2>实现方法</h2>${Array.from({ length: 12 }, () => "<p>这是一段用于本地浏览器验证的正文，介绍工程实现、验证方式和适用条件。This is synthetic fixture text for local reader verification.</p>").join("")}<h2>验证结果</h2><pre><code class="language-ts">const message = "${"code-example-".repeat(60)}";</code></pre><table><tr><th>场景</th><th>结果</th></tr><tr><td>小屏幕表格</td><td>${"long-value-".repeat(50)}</td></tr></table><figure><img src="https://example.org/reader-fixture.svg" alt="测试架构图"></figure><h3>适用条件</h3><p>测试正文结束。${index === 43 ? "本文仅展示部分内容" : ""}</p>`,
    });
    return articleBodySchema.parse({
      articleId: article.id,
      ...parsed,
      contentHash: digest(parsed.html),
      sourceId: article.locations[0].sourceId,
      sourceUrl: article.canonicalUrl,
      engineVersion: ENGINE_VERSION,
      fetchedAt: checkedAt,
      checkedAt,
    });
  });
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
  bodyFixtures,
);
console.log("Fixture snapshot written. Synthetic data must never be deployed.");
