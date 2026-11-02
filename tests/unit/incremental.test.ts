import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../packages/crawler/http.js", async (original) => ({
  ...(await original<typeof import("../../packages/crawler/http.js")>()),
  fetchReviewed: vi.fn(),
}));
import { fetchReviewed } from "../../packages/crawler/http.js";
import { ingest } from "../../packages/crawler/ingest.js";
import { collectBodies } from "../../packages/crawler/bodies.js";
import { articleParser } from "../../packages/article-parser/index.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { prepareCandidate } from "../../packages/crawler/incremental.js";
import type {
  Article,
  Candidate,
  Snapshot,
} from "../../packages/shared/types.js";

const all = await loadRegistry();
const source = {
  ...all.sources.find((s) => s.id === "meituan")!,
  authorAllowlist: undefined,
};
const registry = { ...all, sources: [source] };
const date = "2026-10-01T00:00:00.000Z";
const candidate = (id: string): Candidate => ({
  title: `工程文章 ${id}`,
  url: `https://tech.meituan.com/${id}`,
  publishedAt: date,
});
const parsed = (article: Article) =>
  articleParser.parse({
    url: article.canonicalUrl,
    title: article.title,
    fragment: true,
    content: `<h2>正文</h2><p>${"系统设计与工程实践。".repeat(30)}</p>`,
  });
const feed = (items: Candidate[]) =>
  `<rss><channel><title>Team</title>${items.map((item) => `<item><title>${item.title}</title><link>${item.url}</link><pubDate>${date}</pubDate></item>`).join("")}</channel></rss>`;
function snapshot(items: Candidate[]): Snapshot {
  const articles: Article[] = [];
  for (const item of items) upsert(articles, item, source, registry);
  return {
    articles,
    states: [
      {
        sourceId: source.id,
        status: "success",
        consecutiveFailures: 0,
        discovered: items.length,
        lastSuccessAt: date,
      },
    ],
    manifest: {
      schemaVersion: 1,
      generatedAt: date,
      articleCount: items.length,
      sourceCount: 1,
      files: {},
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-11-02T01:17:00Z");
  vi.mocked(fetchReviewed).mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("daily incremental collection", () => {
  it("checks the directory without validators when detail metadata from the previous run is still missing", async () => {
    const data = snapshot([candidate("old")]);
    data.states[0].etag = "previous";
    data.articles[0].locations[0].metadataPending = true;
    vi.mocked(fetchReviewed)
      .mockResolvedValueOnce({
        status: 200,
        text: feed([candidate("old")]),
        url: source.url,
      })
      .mockResolvedValueOnce({
        status: 200,
        text: '<meta name="description" content="补齐的介绍">',
        url: candidate("old").url,
      });
    const result = await ingest(data, registry, { daily: true });
    expect(vi.mocked(fetchReviewed).mock.calls[0][2]).toEqual({});
    expect(fetchReviewed).toHaveBeenCalledTimes(2);
    expect(result.articles[0].description).toBe("补齐的介绍");
    expect(result.articles[0].locations[0].metadataPending).toBeUndefined();
  });
  it("retains pending refreshes across a saved checkpoint after metadata has already advanced", async () => {
    const data = snapshot([candidate("a"), candidate("b")]);
    const old = await collectBodies(data.articles, [], registry, {
      loader: async (a) => parsed(a),
    });
    const first = await collectBodies(data.articles, old.bodies, registry, {
      incremental: true,
      changedArticleIds: data.articles.map((a) => a.id),
      limit: 1,
      loader: async (a) => parsed(a),
    });
    expect(first.bodies.filter((b) => b.refreshPending)).toHaveLength(1);
    // Persisted JSON is all the next run knows; it receives no transient change list.
    const resumed = await collectBodies(
      data.articles,
      JSON.parse(JSON.stringify(first.bodies)),
      registry,
      { incremental: true, loader: async (a) => parsed(a) },
    );
    expect(resumed.attempted).toBe(1);
    expect(resumed.bodies.some((b) => b.refreshPending)).toBe(false);
  });
  it("fetches new and previously failed articles, then retries after 304 and stops after recovery", async () => {
    const data = snapshot([candidate("old"), candidate("failed")]);
    const boot = await collectBodies(data.articles, [], registry, {
      loader: async (a) => {
        if (a.canonicalUrl.endsWith("failed")) throw new Error("HTTP 521");
        return parsed(a);
      },
    });
    data.bodies = boot.bodies;
    const old = data.bodies.find((b) => b.status === "ready")!;
    old.nextRetryAt = "2026-10-01T00:00:00.000Z"; // aged successful body is still skipped
    vi.mocked(fetchReviewed)
      .mockResolvedValueOnce({
        status: 200,
        text: feed([candidate("new"), candidate("old"), candidate("failed")]),
        url: source.url,
        etag: "day-one",
      })
      .mockResolvedValueOnce({
        status: 200,
        text: '<meta name="description" content="新文章的介绍">',
        url: candidate("new").url,
      });
    const first = await ingest(data, registry, { daily: true });
    expect(first).toMatchObject({ added: 1, updated: 0, unchanged: 2 });
    const calls: string[] = [];
    const bodies = await collectBodies(first.articles, data.bodies, registry, {
      incremental: true,
      changedArticleIds: first.changedArticleIds,
      loader: async (a) => {
        calls.push(a.canonicalUrl);
        if (a.canonicalUrl.endsWith("failed")) throw new Error("HTTP 521");
        return parsed(a);
      },
    });
    expect(calls).toEqual([candidate("new").url, candidate("failed").url]);
    expect(bodies.bodies.find((b) => b.articleId === old.articleId)).toEqual(
      old,
    );
    expect(fetchReviewed).toHaveBeenCalledTimes(2); // listing + new article metadata only
    expect(vi.mocked(fetchReviewed).mock.calls[1][0]).toBe(
      candidate("new").url,
    );
    let saved: Snapshot = {
      ...data,
      articles: first.articles,
      states: first.states,
      bodies: bodies.bodies,
    };
    vi.setSystemTime("2026-11-03T01:17:00Z");
    vi.mocked(fetchReviewed).mockResolvedValue({
      status: 304,
      text: "",
      url: source.url,
    });
    const second = await ingest(saved, registry, { daily: true });
    expect(vi.mocked(fetchReviewed).mock.calls.at(-1)?.[2]).toMatchObject({
      "If-None-Match": "day-one",
    });
    const recovered = vi.fn(async (a: Article) => parsed(a));
    const retry = await collectBodies(
      second.articles,
      saved.bodies!,
      registry,
      {
        incremental: true,
        changedArticleIds: second.changedArticleIds,
        loader: recovered,
      },
    );
    expect(retry.attempted).toBe(1);
    expect(recovered.mock.calls[0][0].canonicalUrl).toBe(
      candidate("failed").url,
    );
    expect(retry.unavailable).toBe(0);
    saved = {
      ...saved,
      articles: second.articles,
      states: second.states,
      bodies: retry.bodies,
    };
    vi.setSystemTime("2026-11-04T01:17:00Z");
    const third = await ingest(saved, registry, { daily: true });
    const nothing = await collectBodies(
      third.articles,
      saved.bodies!,
      registry,
      {
        incremental: true,
        changedArticleIds: third.changedArticleIds,
        loader: recovered,
      },
    );
    expect(nothing.attempted).toBe(0);
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it("detects edits to known/backdated articles and preserves old HTML when their refresh fails", async () => {
    const data = snapshot([candidate("old")]);
    data.bodies = (
      await collectBodies(data.articles, [], registry, {
        loader: async (a) => parsed(a),
      })
    ).bodies;
    const before = data.bodies[0];
    vi.mocked(fetchReviewed).mockResolvedValue({
      status: 200,
      text: feed([{ ...candidate("old"), title: "旧文章修订版" }]),
      url: source.url,
    });
    const result = await ingest(data, registry, { daily: true });
    expect(result.updated).toBe(1);
    const failed = await collectBodies(result.articles, data.bodies, registry, {
      incremental: true,
      changedArticleIds: result.changedArticleIds,
      loader: async () => {
        throw new Error("HTTP 521");
      },
    });
    expect(failed.attempted).toBe(1);
    expect(failed.bodies[0]).toMatchObject({
      status: "ready",
      html: before.html,
      fetchedAt: before.fetchedAt,
      error: "HTTP 521",
    });
    const retried = await collectBodies(
      result.articles,
      failed.bodies,
      registry,
      { incremental: true, loader: async (a) => parsed(a) },
    );
    expect(retried.attempted).toBe(1);
    expect(retried.bodies[0].error).toBeUndefined();
  });

  it("retries all failed bodies beyond the former 40-item limit, independent of listing windows", async () => {
    const data = snapshot(
      Array.from({ length: 45 }, (_, i) => candidate(`history-${i}`)),
    );
    const previous = await collectBodies(data.articles, [], registry, {
      loader: async () => {
        throw new Error("521");
      },
    });
    const result = await collectBodies(
      data.articles,
      previous.bodies,
      registry,
      { incremental: true, loader: async (a) => parsed(a) },
    );
    expect(result.attempted).toBe(45);
    expect(result.ready).toBe(45);
  });

  it("does not let repeatedly failing recent posts starve older retries under an explicit limit", async () => {
    const data = snapshot([candidate("a"), candidate("b")]);
    const loader = vi.fn(async () => {
      throw new Error("521");
    });
    const previous = await collectBodies(data.articles, [], registry, {
      loader,
    });
    vi.setSystemTime("2026-11-03T01:17:00Z");
    const one = await collectBodies(data.articles, previous.bodies, registry, {
      incremental: true,
      limit: 1,
      loader,
    });
    const first = loader.mock.calls.at(-1);
    vi.setSystemTime("2026-11-04T01:17:00Z");
    await collectBodies(data.articles, one.bodies, registry, {
      incremental: true,
      limit: 1,
      loader,
    });
    expect(loader.mock.calls.at(-1)).not.toEqual(first);
  });

  it("keeps the raw listing hash stable after detail enrichment and retries failed metadata enrichment", () => {
    const item = candidate("old");
    prepareCandidate(item, source, {});
    const data = snapshot([{ ...item, title: "详情页补充的文章标题" }]);
    const unchanged = candidate("old");
    prepareCandidate(unchanged, source, {
      incremental: true,
      knownArticles: data.articles,
    });
    expect(unchanged.unchanged).toBe(true);
    data.articles[0].locations[0].metadataPending = true;
    prepareCandidate(unchanged, source, {
      incremental: true,
      knownArticles: data.articles,
    });
    expect(unchanged.unchanged).not.toBe(true);
  });
});
