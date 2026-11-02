import { z } from "zod";
import type { Article } from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import { markAdvertorials } from "../classifier/advertorial.js";
import { applyOverrides } from "../crawler/ingest.js";
import { publishedArticles } from "../publisher/export.js";
import { loadScoringConfig } from "./config.js";
import { READING_RUBRIC } from "./rubric.js";
import { titleHash } from "./cache.js";
import {
  OPENCODE_JEV_ENDPOINT,
  percentageScore,
} from "./providers/opencode-jev.js";

const wireSchema = z.object({
  model: z.string(),
  answers: z.record(
    z.string(),
    z.object({ type: z.literal("score"), score: z.number().finite() }),
  ),
  usage: z
    .object({
      input_tokens: z.number().nonnegative(),
      output_tokens: z.number().nonnegative(),
    })
    .optional(),
});

/** Strict release probe: one real request, no fallback, no snapshot writes. */
export async function validateScoringBatch(
  articles: Article[],
  registry: Registry,
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof globalThis.fetch } = {},
) {
  const reviewed = structuredClone(articles);
  markAdvertorials(reviewed);
  await applyOverrides(reviewed);
  const published = publishedArticles(reviewed, registry);
  const items = published
    .filter(
      (a) => a.contentType !== "paper" && a.advertorial?.status !== "suspected",
    )
    .slice(0, 128);
  if (items.length !== 128)
    throw new Error("Live validation requires 128 eligible real blog titles");
  let calls = 0;
  let wire: z.infer<typeof wireSchema> | undefined;
  const requestSizes: number[] = [];
  const instrumented: typeof globalThis.fetch = async (input, init) => {
    calls++;
    if (calls !== 1 || input !== OPENCODE_JEV_ENDPOINT)
      throw new Error("Unexpected validation request");
    const payload = JSON.parse(String(init?.body));
    if (
      payload.model !== "jev-1.13-free" ||
      payload.state.titles.length !== 128 ||
      Object.keys(payload.questions).length !== 128 ||
      JSON.stringify(payload.state.titles) !==
        JSON.stringify(items.map((a) => a.title))
    )
      throw new Error(
        "Validation request does not contain the expected 128 titles",
      );
    requestSizes.push(payload.state.titles.length);
    const response = await (options.fetch ?? globalThis.fetch)(input, init);
    if (response.ok) wire = wireSchema.parse(await response.clone().json());
    return response;
  };
  const config = await loadScoringConfig(options.env ?? process.env, {
    fetch: instrumented,
  });
  const provider = config.providers.find((p) => p.id === "opencode-jev-free");
  if (!provider) throw new Error("Free Jev validation provider is not enabled");
  const startedAt = Date.now();
  const results = await provider.scoreBatch(
    items.map(({ id, title }) => ({ id, title })),
    READING_RUBRIC,
    AbortSignal.timeout(config.requestTimeoutMs),
  );
  if (
    calls !== 1 ||
    results.length !== 128 ||
    !wire ||
    Object.keys(wire.answers).length !== 128
  )
    throw new Error("Live batch did not return all 128 answers in one request");
  const answers = wire.answers;
  const scores = items.map((article, index) => {
    const result = results[index];
    const answer = answers[`title_${index}`];
    if (
      !answer ||
      result.id !== article.id ||
      result.score !==
        percentageScore(answer.score, READING_RUBRIC.levels.length)
    )
      throw new Error("Live answer alignment or percentage conversion failed");
    return {
      id: article.id,
      title: article.title,
      titleHash: titleHash(article.title),
      rawScore: answer.score,
      score: result.score,
    };
  });
  return {
    schemaVersion: 1,
    verifiedAt: new Date().toISOString(),
    passed: true,
    provider: provider.id,
    model: wire.model,
    rubricVersion: READING_RUBRIC.version,
    requestCount: calls,
    requestSizes,
    answerCount: results.length,
    elapsedMs: Date.now() - startedAt,
    usage: wire.usage,
    excludedSuspected: published.filter(
      (a) => a.advertorial?.status === "suspected",
    ).length,
    excludedPapers: published.filter((a) => a.contentType === "paper").length,
    scores,
  };
}
