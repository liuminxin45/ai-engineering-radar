import { mkdir, writeFile } from "node:fs/promises";
import { loadRegistry } from "../packages/source-registry/index.js";
import {
  createRssHubClient,
  rssHubBody,
  rssHubCandidates,
} from "../packages/crawler/rsshub.js";
import { articleParser } from "../packages/article-parser/index.js";

const load = createRssHubClient();
if (!load)
  throw new Error("Set RSSHUB_URL to the self-hosted service before probing");
const registry = await loadRegistry();
const results = [];
for (const source of registry.sources.filter(
  (s) =>
    s.platform === "csdn-feed" &&
    s.crawl.enabled &&
    s.verification.status === "verified",
)) {
  try {
    const items = await load(source, { fullText: true });
    const bodies = items.map((item) => {
      try {
        const body = articleParser.parse({
          url: item.link,
          title: item.title,
          content: rssHubBody(items, item.link),
          fragment: true,
          ruleId: "rsshub-csdn",
        });
        return {
          url: item.link,
          status: body.status,
          textLength: body.textLength,
        };
      } catch (error) {
        return {
          url: item.link,
          status: "unavailable",
          error: error instanceof Error ? error.message : "Body unavailable",
        };
      }
    });
    const result = {
      sourceId: source.id,
      discovered: rssHubCandidates(items).length,
      ready: bodies.filter((b) => b.status === "ready").length,
      partial: bodies.filter((b) => b.status === "partial").length,
      unavailable: bodies.filter((b) => b.status === "unavailable").length,
      bodies,
    };
    results.push(result);
    console.log(
      `${source.id}: ${result.discovered} discovered, ${result.ready} ready, ${result.partial} partial, ${result.unavailable} unavailable`,
    );
  } catch {
    results.push({
      sourceId: source.id,
      error: "RSSHub feed unavailable; inspect service logs",
    });
    console.log(`${source.id}: feed unavailable`);
  }
}
await mkdir("work", { recursive: true });
await writeFile(
  "work/rsshub-validation.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) +
    "\n",
);
if (results.every((r) => "error" in r)) process.exitCode = 1;
