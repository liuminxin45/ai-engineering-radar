import type { Article } from "../shared/types.js";
import { readingScoreSchema } from "../shared/reading-score.js";
import type { Registry } from "../source-registry/index.js";
import { markAdvertorials } from "../classifier/advertorial.js";
import { applyOverrides } from "../crawler/ingest.js";
import { publishedArticles } from "../publisher/export.js";
import {
  clearInvalidReadingScore,
  hasCurrentReadingScore,
  titleHash,
} from "./cache.js";
import { ProviderPool } from "./pool.js";
import { READING_RUBRIC } from "./rubric.js";
import type { ScoringProvider } from "./types.js";

export async function scoreArticles(
  articles: Article[],
  registry: Registry,
  options: {
    providers: readonly ScoringProvider[];
    batchSize?: number;
    requestTimeoutMs?: number;
    budgetMs?: number;
  },
) {
  markAdvertorials(articles);
  await applyOverrides(articles);
  for (const article of articles) clearInvalidReadingScore(article);
  const eligible = publishedArticles(articles, registry).filter(
    (a) => a.contentType !== "paper" && a.advertorial?.status !== "suspected",
  );
  const pending = eligible.filter((a) => !hasCurrentReadingScore(a));
  const cached = eligible.length - pending.length;
  const pool = new ProviderPool(options.providers, options);
  const batchSize = Math.max(1, Math.min(128, options.batchSize ?? 128));
  let scored = 0;
  for (
    let start = 0;
    start < pending.length && pool.available;
    start += batchSize
  ) {
    const batch = pending.slice(start, start + batchSize);
    const scores = await pool.scoreBatch(
      batch.map(({ id, title }) => ({ id, title })),
      READING_RUBRIC,
    );
    const byId = new Map(batch.map((a) => [a.id, a]));
    for (const score of scores) {
      const article = byId.get(score.id)!;
      article.readingScore = readingScoreSchema.parse({
        score: score.score,
        titleHash: titleHash(article.title),
        rubricVersion: READING_RUBRIC.version,
        provider: score.provider,
        displayName: score.displayName,
        model: score.model,
        scoredAt: new Date().toISOString(),
      });
      scored++;
    }
  }
  return {
    eligible: eligible.length,
    cached,
    scored,
    skipped: pending.length - scored,
    events: pool.events,
  };
}
