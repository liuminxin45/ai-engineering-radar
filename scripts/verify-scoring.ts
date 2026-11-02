import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadSnapshot } from "../packages/database/snapshot.js";
import { loadRegistry } from "../packages/source-registry/index.js";
import { validateScoringBatch } from "../packages/scoring/validation.js";
import { ProviderError } from "../packages/scoring/types.js";

const registry = await loadRegistry();
const snapshot = await loadSnapshot(
  resolve(process.env.RADAR_DATA_DIR ?? ".radar/data"),
  registry,
);
try {
  const report = await validateScoringBatch(snapshot.articles, registry);
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/scoring-validation.json",
    JSON.stringify(
      {
        ...report,
        commit: process.env.GITHUB_SHA ?? null,
        snapshotGeneratedAt: snapshot.manifest.generatedAt,
      },
      null,
      2,
    ) + "\n",
  );
  const summary = `## Live title scoring validation\n\nProvider: ${report.provider}\n\nRequests: ${report.requestCount}, titles: 128, valid ordered answers: ${report.answerCount}\n\nElapsed: ${report.elapsedMs} ms\n\nSnapshot and deployment unchanged.\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
} catch (error) {
  // Keep credentials and upstream response bodies out of Actions logs.
  console.error(
    `Live 128-title validation failed: ${error instanceof ProviderError ? error.kind : "invalid-validation-result"}`,
  );
  process.exitCode = 1;
}
