import { it, expect, vi, beforeEach } from "vitest";
vi.mock("../../packages/crawler/adapters.js", () => ({ collect: vi.fn() }));
import { collect } from "../../packages/crawler/adapters.js";
import { ingest } from "../../packages/crawler/ingest.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import type { Article, Snapshot } from "../../packages/shared/types.js";
import { classifyModel } from "../../packages/classifier/index.js";
const registry = await loadRegistry(),
  source = registry.sources.find((s) => s.id === "meituan")!;
const candidate = {
  title: "Building AI agent sandbox architecture",
  url: "https://tech.meituan.com/agent",
  description: "We implemented runtime tool calling and evaluated latency.",
};
function snapshot(): Snapshot {
  const articles: Article[] = [];
  upsert(articles, candidate, source, registry);
  return {
    manifest: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      articleCount: 1,
      sourceCount: 1,
      files: {},
    },
    articles,
    states: [
      {
        sourceId: source.id,
        status: "success",
        lastSuccessAt: "2026-10-30T00:00:00.000Z",
        etag: "previous-etag",
        consecutiveFailures: 0,
        discovered: 1,
      },
    ],
  };
}
it("daily sweep tolerates schedule drift while preserving HTTP validators", async () => {
  const data = snapshot();
  data.states[0].nextRunAt = "2099-01-01T00:00:00.000Z";
  vi.mocked(collect).mockResolvedValue({
    items: [],
    response: { status: 304, text: "", url: source.url },
    warnings: [],
  });
  await ingest(data, registry, { sourceId: source.id });
  expect(collect).not.toHaveBeenCalled();
  await ingest(data, registry, { sourceId: source.id, daily: true });
  expect(collect).toHaveBeenCalled();
  expect(vi.mocked(collect).mock.calls[0][1].etag).toBe("previous-etag");
});
it("does not publish a partially malformed source batch", async () => {
  vi.mocked(collect).mockResolvedValue({
    items: [
      { ...candidate, url: "https://tech.meituan.com/new", externalId: "new" },
      { ...candidate, url: "javascript:bad" },
    ],
    response: { status: 200, text: "", url: source.url },
    warnings: [],
  });
  const result = await ingest(snapshot(), registry, {
    force: true,
    sourceId: source.id,
  });
  expect(result.successes).toBe(0);
  expect(result.articles).toHaveLength(1);
});
it("keeps uncertain duplicate candidates in review after rule upgrades", async () => {
  const data = snapshot();
  data.articles[0].classification.version = "old";
  data.articles[0].duplicateCandidates = ["other-article"];
  vi.mocked(collect).mockResolvedValue({
    items: [],
    response: { status: 304, text: "", url: source.url },
    warnings: [],
  });
  const result = await ingest(data, registry, {
    force: true,
    sourceId: source.id,
  });
  expect(result.articles[0].classification.status).toBe("review");
  expect(result.articles[0].publicationStatus).toBe("draft");
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("304 preserves articles and advances successful source state", async () => {
  vi.mocked(collect).mockResolvedValue({
    items: [],
    response: { status: 304, text: "", url: source.url },
    warnings: [],
  });
  const result = await ingest(snapshot(), registry, {
    force: true,
    sourceId: source.id,
  });
  expect(result.articles).toHaveLength(1);
  expect(result.states[0].status).toBe("not-modified");
  expect(result.states[0].etag).toBe("previous-etag");
});
it("failure preserves history and previous validators", async () => {
  vi.mocked(collect).mockRejectedValue(new Error("network"));
  const result = await ingest(snapshot(), registry, {
    force: true,
    sourceId: source.id,
  });
  expect(result.successes).toBe(0);
  expect(result.articles[0].publicationStatus).toBe("published");
  expect(result.states[0].etag).toBe("previous-etag");
  expect(result.states[0].consecutiveFailures).toBe(1);
});
it("suspended source is not collected", async () => {
  const suspended = {
    ...registry,
    sources: registry.sources.map((s) =>
      s.id === source.id
        ? {
            ...s,
            crawl: { ...s.crawl, enabled: false },
            verification: { ...s.verification, status: "suspended" as const },
          }
        : s,
    ),
  };
  const result = await ingest(snapshot(), suspended, {
    force: true,
    sourceId: source.id,
  });
  expect(collect).not.toHaveBeenCalled();
  expect(result.articles).toHaveLength(1);
});
it("classification timeout cannot publish an uncertain article", async () => {
  vi.stubEnv("CLASSIFIER_BASE_URL", "https://classifier.example/v1");
  vi.stubEnv("CLASSIFIER_API_KEY", "test-key");
  vi.stubEnv("CLASSIFIER_MODEL", "test-model");
  const data = snapshot();
  data.articles[0].title = "An AI vision";
  data.articles[0].classification.status = "review";
  data.articles[0].publicationStatus = "draft";
  vi.mocked(collect).mockResolvedValue({
    items: [],
    response: { status: 304, text: "", url: source.url },
    warnings: [],
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  try {
    const result = await ingest(data, registry, {
      force: true,
      sourceId: source.id,
    });
    expect(result.articles[0].classification.status).toBe("pending");
    expect(result.articles[0].publicationStatus).toBe("draft");
  } finally {
    vi.unstubAllGlobals();
  }
});
it("rejects model decisions with invented evidence", async () => {
  vi.stubEnv("CLASSIFIER_BASE_URL", "https://classifier.example/v1");
  vi.stubEnv("CLASSIFIER_API_KEY", "test-key");
  vi.stubEnv("CLASSIFIER_MODEL", "test-model");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: "accepted",
                topics: ["agent"],
                reason: "Engineering",
                evidence: ["Invented benchmark"],
              }),
            },
          },
        ],
      }),
    }),
  );
  try {
    await expect(classifyModel(candidate)).rejects.toThrow("not grounded");
  } finally {
    vi.unstubAllGlobals();
  }
});
