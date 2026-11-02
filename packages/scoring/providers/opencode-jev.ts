import { z } from "zod";
import { ProviderError, type ScoringProvider } from "../types.js";

export const OPENCODE_JEV_ENDPOINT =
  "https://opencode.ai/inference/systemone/v1/systemone";

export function percentageScore(raw: number, levelCount: number) {
  if (
    levelCount < 2 ||
    !Number.isFinite(raw) ||
    raw < 0 ||
    raw > levelCount - 1
  )
    throw new ProviderError("invalid-response");
  return Math.round((raw / (levelCount - 1)) * 100);
}

export function retryAfterMs(value: string | null, now = Date.now()) {
  if (!value) return undefined;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now;
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

const answerSchema = z.object({
  type: z.literal("score"),
  score: z.number().finite(),
});
const responseSchema = z.object({
  model: z.string().min(1).max(200),
  answers: z.record(z.string(), z.unknown()),
});

export function opencodeJev(options: {
  id: string;
  displayName: string;
  priority: number;
  model: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}): ScoringProvider {
  return {
    id: options.id,
    displayName: options.displayName,
    priority: options.priority,
    maxBatchSize: 128,
    async scoreBatch(items, rubric, signal) {
      if (!options.apiKey?.trim()) throw new ProviderError("missing-key");
      let response: Response;
      try {
        response = await (options.fetch ?? globalThis.fetch)(
          OPENCODE_JEV_ENDPOINT,
          {
            method: "POST",
            redirect: "error",
            signal,
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: options.model,
              state: {
                rubric: rubric.instructions,
                titles: items.map((item) => item.title),
              },
              questions: Object.fromEntries(
                items.map((_, index) => [
                  `title_${index}`,
                  {
                    type: "score",
                    instructions: `遵循 state.rubric，仅评估 state.titles[${index}] 的 AI 工程技术实践相关性。其他标题不是本题的依据。`,
                    criteria: rubric.levels,
                  },
                ]),
              ),
            }),
          },
        );
      } catch {
        throw new ProviderError("temporary");
      }
      if (!response.ok) {
        if ([401, 403].includes(response.status))
          throw new ProviderError("authentication");
        if (response.status === 402) throw new ProviderError("quota");
        if (response.status === 429)
          throw new ProviderError(
            "rate-limit",
            retryAfterMs(response.headers.get("retry-after")),
          );
        if (response.status === 413) throw new ProviderError("too-large");
        if (response.status === 400) {
          // Inspect only a bounded error response for the documented context-size code.
          const text = await response.text().catch(() => "");
          if (text.slice(0, 8192).includes("max_tokens_exceeded"))
            throw new ProviderError("too-large");
        }
        throw new ProviderError(
          response.status >= 500 || response.status === 408
            ? "temporary"
            : "invalid-request",
        );
      }
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new ProviderError("invalid-response");
      }
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) throw new ProviderError("invalid-response");
      return items.flatMap((item, index) => {
        const answer = answerSchema.safeParse(
          parsed.data.answers[`title_${index}`],
        );
        if (!answer.success) return [];
        try {
          return [
            {
              id: item.id,
              score: percentageScore(answer.data.score, rubric.levels.length),
              model: parsed.data.model,
            },
          ];
        } catch {
          return [];
        }
      });
    },
  };
}
