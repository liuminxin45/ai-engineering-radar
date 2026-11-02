import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { articleSchema, type Article } from "../../packages/shared/types.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import {
  loadSnapshot,
  saveSnapshot,
  validateRelations,
} from "../../packages/database/snapshot.js";
import {
  makeFeed,
  publishedArticles,
} from "../../packages/publisher/export.js";

const overrides = vi.hoisted(() => ({
  articles: {} as Record<string, unknown>,
  merges: [] as unknown[],
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    readFile: vi.fn((...args: Parameters<typeof original.readFile>) =>
      String(args[0]).endsWith("config/overrides.json")
        ? Promise.resolve(JSON.stringify({ schemaVersion: 1, ...overrides }))
        : original.readFile(...args),
    ),
  };
});
import { applyOverrides } from "../../packages/crawler/ingest.js";

const registry = await loadRegistry();
const source = registry.sources.find((s) => s.id === "meituan")!;
const candidate = {
  title: "Joint AI systems research",
  url: "https://example.org/research/joint-agent",
  contentType: "paper" as const,
  companyIds: ["meituan", "tencent"],
};
afterEach(() => {
  overrides.articles = {};
  overrides.merges = [];
});

describe("paper metadata and provenance", () => {
  it("keeps one paper record with multiple company affiliations through repeated collection and snapshot roundtrip", async () => {
    const articles: Article[] = [];
    const paper = upsert(articles, candidate, source, registry);
    upsert(articles, candidate, source, registry);
    // A later response without attribution metadata must preserve reviewed affiliations.
    upsert(
      articles,
      { title: candidate.title, url: candidate.url },
      source,
      registry,
    );
    expect(articles).toHaveLength(1);
    expect(paper.contentType).toBe("paper");
    expect(paper.companyIds).toEqual(["meituan", "tencent"]);
    expect(paper.publisherId).toBe(source.publisherId);
    const dir = await mkdtemp(join(tmpdir(), "radar-paper-"));
    try {
      await saveSnapshot(join(dir, "snapshot"), articles, [], registry);
      expect(
        (await loadSnapshot(join(dir, "snapshot"), registry)).articles[0],
      ).toEqual(JSON.parse(JSON.stringify(paper)));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("supports paper-only sources and explicit per-item attribution in mixed sources", () => {
    const articles: Article[] = [];
    const { contentType: _, companyIds: __, ...item } = candidate;
    const paper = upsert(
      articles,
      item,
      { ...source, contentType: "paper" },
      registry,
    );
    expect(paper.companyIds).toEqual(["meituan"]);
    const id = paper.id;
    upsert(articles, candidate, source, registry, "2026-11-02T01:00:00.000Z");
    expect(paper.id).toBe(id);
    expect(paper.companyIds).toEqual(["meituan", "tencent"]);
    expect(paper.updatedAt).toBe("2026-11-02T01:00:00.000Z");
  });
  it("rejects missing, duplicate and unknown affiliations without weakening publisher ownership", () => {
    const paper = upsert([], candidate, source, registry);
    expect(() =>
      articleSchema.parse({ ...paper, companyIds: undefined }),
    ).toThrow();
    expect(() => articleSchema.parse({ ...paper, companyIds: [] })).toThrow();
    expect(() =>
      articleSchema.parse({ ...paper, companyIds: ["meituan", "meituan"] }),
    ).toThrow();
    expect(() =>
      validateRelations([{ ...paper, companyIds: ["unknown"] }], [], registry),
    ).toThrow(/affiliation/);
    expect(() =>
      validateRelations([{ ...paper, companyId: "tencent" }], [], registry),
    ).toThrow(/publisher relation/);
    expect(() =>
      upsert([], { ...candidate, companyIds: ["unknown"] }, source, registry),
    ).toThrow();
    expect(() =>
      upsert([], { ...candidate, contentType: "blog" }, source, registry),
    ).toThrow();
    expect(() =>
      articleSchema.parse({ ...paper, contentType: "blog" }),
    ).toThrow();
  });
  it("exports paper affiliations in the project feed and excludes unresolved company IDs", () => {
    const paper = upsert([], candidate, source, registry);
    const feed = makeFeed(
      [paper],
      "Radar",
      "https://example.org",
      "feed.xml",
      registry,
      paper.updatedAt,
    ).rss2();
    expect(feed).toContain("美团、腾讯");
    expect(publishedArticles([paper], registry)).toHaveLength(1);
    expect(
      publishedArticles([{ ...paper, companyIds: ["unknown"] }], registry),
    ).toHaveLength(0);
  });
  it("allows reviewed overrides to classify legacy content as a joint paper and revert to a blog", async () => {
    const { contentType: _, companyIds: __, ...legacy } = candidate;
    const article = upsert([], legacy, source, registry);
    overrides.articles[article.id] = {
      contentType: "paper",
      companyIds: candidate.companyIds,
      reason: "已核对原文署名",
    };
    await applyOverrides([article]);
    validateRelations([article], [], registry);
    expect(article.companyIds).toEqual(candidate.companyIds);
    overrides.articles[article.id] = {
      contentType: "blog",
      reason: "原文为论文解读博文",
    };
    await applyOverrides([article]);
    expect(article.contentType).toBe("blog");
    expect(article.companyIds).toBeUndefined();
  });
});
