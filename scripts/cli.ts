import { resolve } from "node:path";
import { mkdir, appendFile } from "node:fs/promises";
import { loadRegistry } from "../packages/source-registry/index.js";
import {
  loadSnapshot,
  saveSnapshot,
  snapshotExists,
  withSnapshotLock,
  validateRelations,
} from "../packages/database/snapshot.js";
import { ingest, applyOverrides } from "../packages/crawler/ingest.js";
import { exportSite } from "../packages/publisher/export.js";
import { resolveSiteUrl } from "../packages/shared/site.js";
import { collectBodies } from "../packages/crawler/bodies.js";
import { upgradeBodyPolicy } from "../packages/crawler/body-policy.js";
const root = resolve(import.meta.dirname, "..");
const dir = resolve(process.env.RADAR_DATA_DIR ?? ".radar/data");
const registry = await loadRegistry();
const command = process.argv[2];
async function run() {
  if (process.argv.includes("--papers"))
    throw new Error("Paper collection has been removed");
  if (command === "registry") {
    console.log(
      `Registry valid: ${registry.sources.length} sources, ${registry.companies.length} companies`,
    );
  } else if (command === "init") {
    if (await snapshotExists(dir))
      throw new Error("Snapshot already exists; refusing to reset it");
    await saveSnapshot(dir, [], [], registry);
    console.log("Initialized empty data snapshot");
  } else {
    const snapshot = await loadSnapshot(dir, registry);
    if (command === "validate")
      console.log(
        `Snapshot valid: ${snapshot.articles.length} articles, ${snapshot.states.length} states, ${snapshot.bodies?.length ?? 0} bodies`,
      );
    else if (command === "ingest") {
      const result = await ingest(snapshot, registry, {
        force:
          process.argv.includes("--force") || process.argv.includes("--full"),
        full: process.argv.includes("--full"),
        daily: process.argv.includes("--daily"),
        probe: true,
        sourceId: process.argv.find((a) => a.startsWith("--source="))?.slice(9),
        contentType: "blog",
      });
      const bodyResult = await collectBodies(
        result.articles,
        snapshot.bodies ?? [],
        registry,
        {
          incremental: !process.argv.includes("--full"),
          force: process.argv.includes("--full"),
          changedArticleIds: result.changedArticleIds,
          sourceId: process.argv
            .find((a) => a.startsWith("--source="))
            ?.slice(9),
          onProgress: async (bodies) => {
            await saveSnapshot(
              dir,
              result.articles,
              result.states,
              registry,
              bodies,
            );
          },
        },
      );
      await saveSnapshot(
        dir,
        result.articles,
        result.states,
        registry,
        bodyResult.bodies,
      );
      const summary = `## AI Engineering Radar\n\nCollection mode: ${process.argv.includes("--full") ? "full" : "incremental"}\n\nSuccessful sources: ${result.successes}/${result.attempted}\n\nMetadata: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged\n\nBodies: ${bodyResult.attempted} attempted, ${bodyResult.ready} ready, ${bodyResult.partial} partial, ${bodyResult.unavailable} unavailable\n\nArticles stored: ${result.articles.length}\n`;
      if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log(summary);
      if (result.attempted && result.successes === 0) process.exitCode = 2;
    } else if (command === "reclassify-bodies") {
      const previous = snapshot.bodies ?? [];
      const bodies = upgradeBodyPolicy(previous);
      await saveSnapshot(
        dir,
        snapshot.articles,
        snapshot.states,
        registry,
        bodies,
      );
      const promoted = bodies.filter(
        (body, index) =>
          body.status === "ready" && previous[index].status === "partial",
      ).length;
      console.log(
        `Stored body policies updated: ${promoted} articles promoted to ready; capture timestamps preserved`,
      );
    } else if (command === "bodies") {
      const limitArg = process.argv
        .find((arg) => arg.startsWith("--limit="))
        ?.slice(8);
      const limit = limitArg === undefined ? undefined : Number(limitArg);
      if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0))
        throw new Error("Body limit must be a positive integer");
      await applyOverrides(snapshot.articles);
      const result = await collectBodies(
        snapshot.articles,
        snapshot.bodies ?? [],
        registry,
        {
          force: process.argv.includes("--force"),
          retryUnavailable: process.argv.includes("--retry-unavailable"),
          sourceId: process.argv
            .find((arg) => arg.startsWith("--source="))
            ?.slice(9),
          limit,
          onProgress: async (bodies) => {
            await saveSnapshot(
              dir,
              snapshot.articles,
              snapshot.states,
              registry,
              bodies,
            );
          },
        },
      );
      await saveSnapshot(
        dir,
        snapshot.articles,
        snapshot.states,
        registry,
        result.bodies,
      );
      const counts = { ready: 0, partial: 0, unavailable: 0 };
      for (const body of result.bodies) counts[body.status]++;
      await mkdir(resolve(root, "work"), { recursive: true });
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        resolve(root, "work/body-backfill.json"),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            attempted: result.attempted,
            counts,
            articles: result.bodies.map(
              ({ html: _html, headings: _headings, ...body }) => body,
            ),
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        `Body backfill: ${result.attempted} attempted; ${counts.ready} ready, ${counts.partial} partial, ${counts.unavailable} unavailable`,
      );
    } else if (command === "export") {
      await applyOverrides(snapshot.articles);
      validateRelations(
        snapshot.articles,
        snapshot.states,
        registry,
        snapshot.bodies,
      );
      await exportSite(snapshot, registry, root, resolveSiteUrl());
    } else throw new Error(`Unknown command: ${command}`);
  }
}
if (command === "registry") await run();
else await withSnapshotLock(dir, run);
