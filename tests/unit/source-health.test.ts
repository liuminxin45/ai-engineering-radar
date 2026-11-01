import { it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { exportSite } from "../../packages/publisher/export.js";
import type { Article, Snapshot } from "../../packages/shared/types.js";

it("reports publication age separately from fetch success and excludes suspended channels from live health", async () => {
  const registry = await loadRegistry();
  const original = registry.sources.find((s) => s.id === "meituan")!;
  const historical = {
    ...original,
    id: "historical-test",
    crawl: { ...original.crawl, enabled: false },
    verification: { ...original.verification, status: "suspended" as const },
  };
  const scoped = { ...registry, sources: [original, historical] };
  const articles: Article[] = [];
  upsert(
    articles,
    {
      title: "Older official article",
      url: "https://tech.meituan.com/old",
      publishedAt: "2026-09-01T00:00:00.000Z",
    },
    original,
    scoped,
  );
  upsert(
    articles,
    {
      title: "Preserved historical article",
      url: "https://tech.meituan.com/history",
      publishedAt: "2020-01-01T00:00:00.000Z",
    },
    historical,
    scoped,
  );
  const snapshot: Snapshot = {
    manifest: {
      schemaVersion: 1,
      generatedAt: "2026-11-01T00:00:00.000Z",
      articleCount: 2,
      sourceCount: 2,
      files: {},
    },
    articles,
    states: [original, historical].map((s) => ({
      sourceId: s.id,
      status: "success" as const,
      lastSuccessAt: "2026-11-01T00:00:00.000Z",
      discovered: 1,
      consecutiveFailures: 0,
    })),
  };
  const root = await mkdtemp(join(tmpdir(), "radar-health-"));
  try {
    await exportSite(snapshot, scoped, root, "https://example.org/radar");
    const { sources } = JSON.parse(
      await readFile(join(root, "apps/web/public/data/sources.json"), "utf8"),
    );
    expect(
      sources.find((s: { id: string }) => s.id === original.id)
        .latestPublishedAt,
    ).toBe("2026-09-01T00:00:00.000Z");
    const { health } = JSON.parse(
      await readFile(join(root, "apps/web/public/data/health.json"), "utf8"),
    );
    expect(health.enabledSources).toBe(1);
    expect(health.successfulSources).toBe(1);
    expect(health.articleCount).toBe(2);
  } finally {
    await rm(root, { recursive: true });
  }
});
