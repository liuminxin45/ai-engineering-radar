import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderPool } from "../../packages/scoring/pool.js";
import {
  ProviderError,
  type ScoringProvider,
  type ScoringItem,
} from "../../packages/scoring/types.js";
import { READING_RUBRIC } from "../../packages/scoring/rubric.js";
import {
  opencodeJev,
  percentageScore,
  retryAfterMs,
} from "../../packages/scoring/providers/opencode-jev.js";
import {
  scoringConfigSchema,
  loadScoringConfig,
} from "../../packages/scoring/config.js";
import { titleHash } from "../../packages/scoring/cache.js";
import { scoreArticles } from "../../packages/scoring/job.js";
import { validateScoringBatch } from "../../packages/scoring/validation.js";
import { articleSchema, type Article } from "../../packages/shared/types.js";
import { readingScoreSchema } from "../../packages/shared/reading-score.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import {
  saveSnapshot,
  loadSnapshot,
} from "../../packages/database/snapshot.js";
import {
  exportSite,
  publishedArticles,
  makeFeed,
} from "../../packages/publisher/export.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const items = (count: number): ScoringItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    title: `AI RAG 工程实现 ${i}`,
  }));
function provider(id: string, priority = 10, score = 83): ScoringProvider {
  return {
    id,
    displayName: id,
    priority,
    maxBatchSize: 128,
    scoreBatch: vi.fn(async (batch: readonly ScoringItem[]) =>
      batch.map(({ id }) => ({ id, score, model: "free-test-model" })),
    ),
  };
}

describe("OpenCode Jev adapter", () => {
  it("sends titles only and matches shuffled answers by question ID", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        model: "jev-1.13",
        answers: {
          title_1: { type: "score", score: 2.5 },
          title_0: { type: "score", score: 4.15 },
        },
      }),
    );
    const p = opencodeJev({
      id: "jev",
      displayName: "Jev",
      priority: 1,
      model: "jev-1.13-free",
      apiKey: "fake-test-key",
      fetch,
    });
    const result = await p.scoreBatch(
      items(2),
      READING_RUBRIC,
      new AbortController().signal,
    );
    expect(result).toEqual([
      { id: "id-0", score: 83, model: "jev-1.13" },
      { id: "id-1", score: 50, model: "jev-1.13" },
    ]);
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.state.titles).toEqual(items(2).map((i) => i.title));
    expect(Object.keys(body.state)).toEqual(["rubric", "titles"]);
    expect(body.questions.title_1.instructions).toContain("state.titles[1]");
    expect(body.model).toBe("jev-1.13-free");
    expect(init.redirect).toBe("error");
  });
  it("sends 128 questions in a single request", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        model: "jev",
        answers: Object.fromEntries(
          items(128).map((_, i) => [`title_${i}`, { type: "score", score: 5 }]),
        ),
      }),
    );
    const p = opencodeJev({
      id: "jev",
      displayName: "Jev",
      priority: 1,
      model: "jev-1.13-free",
      apiKey: "fake",
      fetch,
    });
    expect(
      await p.scoreBatch(
        items(128),
        READING_RUBRIC,
        new AbortController().signal,
      ),
    ).toHaveLength(128);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("omits missing, malformed and out-of-range answers without shifting IDs", async () => {
    const p = opencodeJev({
      id: "jev",
      displayName: "Jev",
      priority: 1,
      model: "free",
      apiKey: "fake",
      fetch: async () =>
        Response.json({
          model: "jev",
          answers: {
            title_0: { type: "score", score: 6 },
            title_2: { type: "score", score: 0 },
            title_3: { type: "score", score: "4" },
          },
        }),
    });
    expect(
      await p.scoreBatch(
        items(4),
        READING_RUBRIC,
        new AbortController().signal,
      ),
    ).toEqual([{ id: "id-2", score: 0, model: "jev" }]);
  });
  it.each([
    [0, 0],
    [1, 20],
    [2.5, 50],
    [3.7, 74],
    [3.75, 75],
    [5, 100],
  ])("converts %s to %s", (raw, value) =>
    expect(percentageScore(raw, 6)).toBe(value),
  );
  it.each([-1, 5.1, NaN, Infinity])("rejects invalid score %s", (raw) =>
    expect(() => percentageScore(raw, 6)).toThrow(ProviderError),
  );
  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [402, "quota"],
    [429, "rate-limit"],
    [413, "too-large"],
    [422, "invalid-request"],
    [503, "temporary"],
  ])("maps HTTP %s without leaking error text", async (status, kind) => {
    const p = opencodeJev({
      id: "jev",
      displayName: "Jev",
      priority: 1,
      model: "free",
      apiKey: "do-not-log",
      fetch: async () => new Response("do-not-log", { status: Number(status) }),
    });
    await expect(
      p.scoreBatch(items(1), READING_RUBRIC, new AbortController().signal),
    ).rejects.toMatchObject({ kind, message: kind });
  });
  it("recognizes context limits, malformed JSON and missing keys", async () => {
    for (const [response, kind] of [
      [
        new Response('{"error":"max_tokens_exceeded"}', { status: 400 }),
        "too-large",
      ],
      [new Response("not JSON"), "invalid-response"],
    ] as const) {
      const p = opencodeJev({
        id: "jev",
        displayName: "Jev",
        priority: 1,
        model: "free",
        apiKey: "fake",
        fetch: async () => response,
      });
      await expect(
        p.scoreBatch(items(1), READING_RUBRIC, new AbortController().signal),
      ).rejects.toMatchObject({ kind });
    }
    const fetch = vi.fn();
    const p = opencodeJev({
      id: "jev",
      displayName: "Jev",
      priority: 1,
      model: "free",
      fetch,
    });
    await expect(
      p.scoreBatch(items(1), READING_RUBRIC, new AbortController().signal),
    ).rejects.toMatchObject({ kind: "missing-key" });
    expect(fetch).not.toHaveBeenCalled();
    expect(retryAfterMs("30")).toBe(30000);
    expect(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 10000)).toBe(50000);
  });
});

describe("priority provider pool", () => {
  it("prefers higher priority and rotates equal priorities across batches", async () => {
    const a = provider("a"),
      b = provider("b"),
      lower = provider("lower", 20);
    const pool = new ProviderPool([lower, a, b]);
    for (const expected of ["a", "b", "a"])
      expect(
        (await pool.scoreBatch(items(1), READING_RUBRIC))[0].provider,
      ).toBe(expected);
    expect(lower.scoreBatch).not.toHaveBeenCalled();
  });
  it("keeps valid partial answers and sends only unresolved IDs to fallback", async () => {
    const a = provider("a"),
      b = provider("b", 20, 50);
    a.scoreBatch = vi.fn(async () => [{ id: "id-1", score: 99, model: "a" }]);
    const pool = new ProviderPool([a, b]);
    const result = await pool.scoreBatch(items(3), READING_RUBRIC);
    expect(result.map((v) => [v.id, v.score])).toEqual([
      ["id-0", 50],
      ["id-1", 99],
      ["id-2", 50],
    ]);
    expect(vi.mocked(b.scoreBatch).mock.calls[0][0].map((v) => v.id)).toEqual([
      "id-0",
      "id-2",
    ]);
    expect(pool.events).toContainEqual({
      provider: "a",
      kind: "invalid-response",
      count: 2,
    });
  });
  it.each([
    "authentication",
    "quota",
    "missing-key",
    "invalid-request",
  ] as const)("disables %s failures only for this run", async (kind) => {
    const a = provider("a"),
      b = provider("b", 20);
    a.scoreBatch = vi.fn(async () => {
      throw new ProviderError(kind);
    });
    const pool = new ProviderPool([a, b]);
    await pool.scoreBatch(items(1), READING_RUBRIC);
    await pool.scoreBatch(items(1), READING_RUBRIC);
    expect(a.scoreBatch).toHaveBeenCalledTimes(1);
    await new ProviderPool([a]).scoreBatch(items(1), READING_RUBRIC);
    expect(a.scoreBatch).toHaveBeenCalledTimes(2);
  });
  it("honors rate-limit cooldown then resumes the higher priority provider", async () => {
    let now = 0;
    const a = provider("a"),
      b = provider("b", 20);
    vi.mocked(a.scoreBatch).mockRejectedValueOnce(
      new ProviderError("rate-limit", 30000),
    );
    const pool = new ProviderPool([a, b], { now: () => now });
    expect((await pool.scoreBatch(items(1), READING_RUBRIC))[0].provider).toBe(
      "b",
    );
    now = 29999;
    expect((await pool.scoreBatch(items(1), READING_RUBRIC))[0].provider).toBe(
      "b",
    );
    now = 30000;
    expect((await pool.scoreBatch(items(1), READING_RUBRIC))[0].provider).toBe(
      "a",
    );
  });
  it("does not wait when every provider is unavailable", async () => {
    const a = provider("a");
    a.scoreBatch = vi.fn(async () => {
      throw new Error("secret-remote-error");
    });
    const pool = new ProviderPool([a]);
    expect(await pool.scoreBatch(items(2), READING_RUBRIC)).toEqual([]);
    expect(pool.available).toBe(false);
    expect(pool.events[0].kind).toBe("temporary");
    expect(JSON.stringify(pool.events)).not.toContain("secret");
  });
  it("splits too-large batches and keeps successful halves before a later failure", async () => {
    const a = provider("a"),
      b = provider("b", 20);
    a.scoreBatch = vi.fn(async (batch: readonly ScoringItem[]) => {
      if (batch.length > 2) throw new ProviderError("too-large");
      if (batch[0].id === "id-2") throw new ProviderError("quota");
      return batch.map(({ id }) => ({ id, score: 90, model: "a" }));
    });
    const result = await new ProviderPool([a, b]).scoreBatch(
      items(4),
      READING_RUBRIC,
    );
    expect(result.map((r) => r.provider)).toEqual(["a", "a", "b", "b"]);
    expect(
      vi.mocked(a.scoreBatch).mock.calls.map(([batch]) => batch.length),
    ).toEqual([4, 2, 2]);
  });
  it("respects adapter batch limits and rejects unknown or invalid results", async () => {
    const a = provider("a");
    a.maxBatchSize = 2;
    await new ProviderPool([a]).scoreBatch(items(5), READING_RUBRIC);
    expect(
      vi.mocked(a.scoreBatch).mock.calls.map(([batch]) => batch.length),
    ).toEqual([2, 2, 1]);
    a.scoreBatch = vi.fn(async () => [
      { id: "unknown", score: 80, model: "a" },
      { id: "id-0", score: NaN, model: "a" },
    ]);
    expect(
      await new ProviderPool([a]).scoreBatch(items(1), READING_RUBRIC),
    ).toEqual([]);
  });
  it("aborts stuck adapters and falls through within the total budget", async () => {
    const a = provider("a"),
      b = provider("b", 20);
    let signal: AbortSignal | undefined;
    a.scoreBatch = vi.fn<ScoringProvider["scoreBatch"]>(async (_, __, s) => {
      signal = s;
      return new Promise<never>(() => {});
    });
    const pool = new ProviderPool([a, b], {
      requestTimeoutMs: 10,
      budgetMs: 1000,
    });
    expect((await pool.scoreBatch(items(1), READING_RUBRIC))[0].provider).toBe(
      "b",
    );
    expect(signal?.aborted).toBe(true);
  });
  it("stops issuing requests after the total budget expires", async () => {
    let now = 0;
    const a = provider("a"),
      b = provider("b", 20);
    a.scoreBatch = vi.fn(async () => {
      now = 121000;
      throw new ProviderError("temporary");
    });
    const pool = new ProviderPool([a, b], { now: () => now });
    expect(await pool.scoreBatch(items(1), READING_RUBRIC)).toEqual([]);
    expect(b.scoreBatch).not.toHaveBeenCalled();
  });
});

const registry = await loadRegistry();
function articles(count: number) {
  const values: Article[] = [];
  const source = registry.sources.find((s) => s.id === "meituan")!;
  for (let i = 0; i < count; i++)
    upsert(
      values,
      {
        title: `AI RAG 系统调试与架构实现 ${i}`,
        url: `https://tech.meituan.com/scoring-test-${i}`,
        externalId: `scoring-${i}`,
        publishedAt: new Date(Date.UTC(2026, 9, 30, 0, 0, i)).toISOString(),
      },
      source,
      registry,
    );
  return values;
}
function cached(article: Article) {
  return readingScoreSchema.parse({
    score: 83,
    titleHash: titleHash(article.title),
    rubricVersion: READING_RUBRIC.version,
    provider: "previous-provider",
    displayName: "Jev",
    model: "jev-1.13",
    scoredAt: "2026-11-01T00:00:00Z",
  });
}

describe("title scoring job and snapshots", () => {
  it("strict live validation verifies one 128-title request without modifying the snapshot", async () => {
    const values = articles(130);
    values[0].title = "免费报名！活动报名开启";
    values[1].contentType = "paper";
    const before = structuredClone(values);
    const fetch = vi.fn(async () =>
      Response.json({
        model: "jev-1.13",
        answers: Object.fromEntries(
          Array.from({ length: 128 }, (_, i) => [
            `title_${i}`,
            { type: "score", score: i % 6 },
          ]),
        ),
        usage: { input_tokens: 12345, output_tokens: 128 },
      }),
    );
    const report = await validateScoringBatch(values, registry, {
      env: { OPENCODE_API_KEY: "fake" },
      fetch,
    });
    expect(report).toMatchObject({
      passed: true,
      requestCount: 1,
      requestSizes: [128],
      answerCount: 128,
      excludedSuspected: 1,
      excludedPapers: 1,
    });
    expect(report.scores[0]).toMatchObject({
      id: values.at(-1)!.id,
      rawScore: 0,
      score: 0,
    });
    expect(report.scores[5].score).toBe(100);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(values).toEqual(before);
  });
  it("strict live validation rejects insufficient titles and missing answers instead of falling back", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ model: "jev", answers: {} }),
    );
    await expect(
      validateScoringBatch(articles(127), registry, { env: {}, fetch }),
    ).rejects.toThrow("requires 128");
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      validateScoringBatch(articles(128), registry, {
        env: { OPENCODE_API_KEY: "fake" },
        fetch,
      }),
    ).rejects.toThrow("all 128 answers");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("backs up all unscored titles in batches of 128, newest first, then uses cache", async () => {
    const values = articles(259),
      p = provider("new-provider");
    const before = structuredClone(
      values.map((a) => [a.id, a.classification, a.publicationStatus]),
    );
    expect(
      (await scoreArticles(values, registry, { providers: [p] })).scored,
    ).toBe(259);
    expect(
      vi.mocked(p.scoreBatch).mock.calls.map(([batch]) => batch.length),
    ).toEqual([128, 128, 3]);
    expect(vi.mocked(p.scoreBatch).mock.calls[0][0][0].id).toBe(
      values.at(-1)!.id,
    );
    expect(
      values.map((a) => [a.id, a.classification, a.publicationStatus]),
    ).toEqual(before);
    expect(
      (
        await scoreArticles(values, registry, {
          providers: [provider("another")],
        })
      ).cached,
    ).toBe(259);
  });
  it("skips suspected advertorials, papers and hidden records, including stale scores", async () => {
    const values = articles(4),
      p = provider("a");
    values[0].title = "免费报名！活动报名开启";
    values[1].contentType = "paper";
    values[2].publicationStatus = "hidden";
    for (const a of values) a.readingScore = cached(a);
    await scoreArticles(values, registry, { providers: [p] });
    expect(values[0].advertorial?.status).toBe("suspected");
    expect(values[0].readingScore).toBeUndefined();
    expect(values[1].readingScore).toBeUndefined();
    expect(p.scoreBatch).not.toHaveBeenCalled();
    expect(values[3].readingScore?.score).toBe(83);
  });
  it("honors manual cleared/suspected overrides before invoking providers", async () => {
    const values = articles(2),
      p = provider("a");
    values[0].title = "免费报名！活动报名开启";
    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify({
        schemaVersion: 1,
        articles: {
          [values[0].id]: {
            advertorial: "cleared",
            reason: "人工确认是工程实践",
          },
          [values[1].id]: {
            advertorial: "suspected",
            reason: "人工确认是推广",
          },
        },
        merges: [],
      }),
    );
    await scoreArticles(values, registry, { providers: [p] });
    expect(vi.mocked(p.scoreBatch).mock.calls[0][0].map((a) => a.id)).toEqual([
      values[0].id,
    ]);
    expect(values[0].advertorial?.status).toBe("cleared");
    expect(values[1].readingScore).toBeUndefined();
  });
  it("invalidates title/rubric changes, retains valid cache, and never invents a zero on failure", async () => {
    const values = articles(4);
    values.forEach((a) => {
      a.readingScore = cached(a);
    });
    values[1].title += " revised";
    values[2].readingScore!.rubricVersion = "old";
    delete values[3].readingScore;
    const before = structuredClone(values[0].readingScore);
    const result = await scoreArticles(values, registry, { providers: [] });
    expect(result).toMatchObject({ cached: 1, scored: 0, skipped: 3 });
    expect(values[0].readingScore).toEqual(before);
    expect(values.slice(1).every((a) => !a.readingScore)).toBe(true);
  });
  it("makes zero daily requests for unchanged titles and scores only newly discovered titles", async () => {
    const values = articles(3),
      p = provider("incremental");
    await scoreArticles(values, registry, { providers: [p] });
    const cachedScores = structuredClone(values.map((a) => a.readingScore));
    vi.mocked(p.scoreBatch).mockClear();
    // Body, listing metadata, author, summary and dates do not invalidate a title-only score.
    values[0].description = "重新获取的摘要，与正文补抓无关";
    values[0].author = "Updated author";
    values[0].updatedAt = "2026-11-02T00:00:00Z";
    const unchanged = await scoreArticles(values, registry, { providers: [p] });
    expect(unchanged).toMatchObject({ scored: 0, cached: 3 });
    expect(p.scoreBatch).not.toHaveBeenCalled();
    values.push(articles(4)[3]);
    const incremental = await scoreArticles(values, registry, {
      providers: [p],
    });
    expect(incremental).toMatchObject({ scored: 1, cached: 3 });
    expect(p.scoreBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(p.scoreBatch).mock.calls[0][0].map((a) => a.id)).toEqual([
      values[3].id,
    ]);
    expect(values.slice(0, 3).map((a) => a.readingScore)).toEqual(cachedScores);
  });
  it("roundtrips old and scored snapshots and exports only current scores without changing feeds", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-scoring-"));
    try {
      const values = articles(4);
      expect(articleSchema.parse(values[0]).readingScore).toBeUndefined();
      const dir = join(root, "snapshot");
      await saveSnapshot(dir, values, [], registry);
      expect(
        (await loadSnapshot(dir, registry)).articles.every(
          (a) => !a.readingScore,
        ),
      ).toBe(true);
      const generatedAt = "2026-11-02T00:00:00Z";
      const before = makeFeed(
        publishedArticles(values, registry),
        "Radar",
        "https://example.org",
        "feed.xml",
        registry,
        generatedAt,
      ).rss2();
      await scoreArticles(values, registry, { providers: [provider("Jev")] });
      const after = makeFeed(
        publishedArticles(values, registry),
        "Radar",
        "https://example.org",
        "feed.xml",
        registry,
        generatedAt,
      ).rss2();
      expect(after).toBe(before);
      await saveSnapshot(dir, values, [], registry);
      const snapshot = await loadSnapshot(dir, registry);
      expect(snapshot.articles.every((a) => a.readingScore?.score === 83)).toBe(
        true,
      );
      const changed = snapshot.articles[0];
      changed.title += " changed";
      snapshot.articles[1].title = "立即购买！限时免费福利";
      await mkdir(join(root, "work"), { recursive: true });
      await exportSite(snapshot, registry, root, "https://example.org");
      const data = JSON.parse(
        await readFile(
          join(root, "apps/web/public/data/articles.json"),
          "utf8",
        ),
      );
      expect(data.articles).toHaveLength(4);
      expect(
        data.articles.find((a: Article) => a.id === changed.id).readingScore,
      ).toBeUndefined();
      expect(
        data.articles.find((a: Article) => a.title.startsWith("立即购买"))
          .readingScore,
      ).toBeUndefined();
      expect(data.articles.filter((a: Article) => a.readingScore)).toHaveLength(
        2,
      );
      expect(snapshot.articles[0].readingScore).toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("validates provider configuration and resolves keys from injected environment only", async () => {
    const config = JSON.parse(
      await readFile(
        new URL("../../config/scoring-providers.json", import.meta.url),
        "utf8",
      ),
    );
    expect(scoringConfigSchema.parse(config).providers[0].model).toBe(
      "jev-1.13-free",
    );
    expect(() =>
      scoringConfigSchema.parse({
        ...config,
        providers: [...config.providers, ...config.providers],
      }),
    ).toThrow();
    const { providers } = await loadScoringConfig({});
    expect(
      await new ProviderPool(providers).scoreBatch(items(1), READING_RUBRIC),
    ).toEqual([]);
    expect(
      readingScoreSchema.safeParse({ ...cached(articles(1)[0]), score: 101 })
        .success,
    ).toBe(false);
  });
});
