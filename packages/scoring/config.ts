import { readFile } from "node:fs/promises";
import { z } from "zod";
import { opencodeJev } from "./providers/opencode-jev.js";

// Register new protocol adapters here; the pool and article job stay unchanged.
const adapters = { "opencode-jev": opencodeJev };

export const scoringConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    batchSize: z.number().int().min(1).max(128).default(128),
    requestTimeoutMs: z.number().int().positive().max(120000).default(20000),
    budgetMs: z.number().int().positive().max(600000).default(120000),
    providers: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,100}$/),
            adapter: z.literal("opencode-jev"),
            displayName: z.string().min(1).max(40),
            enabled: z.boolean(),
            priority: z.number().int().nonnegative(),
            model: z.string().min(1).max(200),
            apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
          })
          .strict(),
      )
      .refine(
        (items) => new Set(items.map((p) => p.id)).size === items.length,
        "Duplicate provider ID",
      ),
  })
  .strict();

export async function loadScoringConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { fetch?: typeof globalThis.fetch } = {},
) {
  const config = scoringConfigSchema.parse(
    JSON.parse(
      await readFile(
        new URL("../../config/scoring-providers.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  return {
    ...config,
    providers: config.providers
      .filter((p) => p.enabled)
      .map((p) =>
        adapters[p.adapter]({
          ...p,
          apiKey: env[p.apiKeyEnv],
          fetch: options.fetch,
        }),
      ),
  };
}
