import { resolve } from "node:path";
import { mkdir, appendFile } from "node:fs/promises";
import { loadRegistry } from "../packages/source-registry/index.js";
import {
  loadSnapshot,
  saveSnapshot,
  snapshotExists,
  withSnapshotLock,
} from "../packages/database/snapshot.js";
import { ingest, applyOverrides } from "../packages/crawler/ingest.js";
import { exportSite } from "../packages/publisher/export.js";
const root = resolve(import.meta.dirname, "..");
const dir = resolve(process.env.RADAR_DATA_DIR ?? ".radar/data");
const registry = await loadRegistry();
const command = process.argv[2];
async function run() {
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
        `Snapshot valid: ${snapshot.articles.length} articles, ${snapshot.states.length} states`,
      );
    else if (command === "ingest") {
      const result = await ingest(snapshot, registry, {
        force: process.argv.includes("--force"),
        daily: process.argv.includes("--daily"),
        probe: true,
        sourceId: process.argv.find((a) => a.startsWith("--source="))?.slice(9),
      });
      await saveSnapshot(dir, result.articles, result.states, registry);
      const summary = `## AI Engineering Radar\n\nSuccessful sources: ${result.successes}/${result.attempted}\n\nArticles stored: ${result.articles.length}\n`;
      if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
      console.log(summary);
      if (result.attempted && result.successes === 0) process.exitCode = 2;
    } else if (command === "export") {
      await applyOverrides(snapshot.articles);
      const base = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
      const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(
        /\/$/,
        "",
      );
      await exportSite(snapshot, registry, root, `${site}${base}`);
    } else throw new Error(`Unknown command: ${command}`);
  }
}
if (command === "registry") await run();
else await withSnapshotLock(dir, run);
