import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createArticleSearchEngine,
  searchExcerpt,
} from "../../apps/web/src/article-search.js";
import {
  SearchSession,
  type SearchEngine,
} from "../../apps/web/src/site-search.js";
import { boardArticles, initialBoardQuery } from "../../apps/web/src/board.js";
import type { Article } from "../../packages/shared/types.js";
const articles = [
  {
    id: "blog-a",
    title: "Redis 性能优化",
    description: "用 AI 分析 Redis latency，保留 <script> 标签与 C++ 字面量。",
    author: "携程团队",
    canonicalUrl: "https://example.org/a",
    discoveredAt: "2026-11-01T00:00:00Z",
  },
  {
    id: "blog-b",
    title: "AI tools",
    description: "A tooling guide",
    canonicalUrl: "https://example.org/b",
    discoveredAt: "2026-10-31T00:00:00Z",
  },
  {
    id: "paper-a",
    contentType: "paper",
    title: "Redis AI paper",
    description: "Research latency",
    canonicalUrl: "https://example.org/p",
    discoveredAt: "2026-10-30T00:00:00Z",
  },
] as Article[];
afterEach(() => vi.useRealTimers());
describe("Radar search adapter", () => {
  it("keeps numbered full-title queries distinct from longer numbers", async () => {
    const numbered = [1, 11, 21].map((number) => ({
      ...articles[0],
      id: String(number),
      title: `Joint AI systems research ${number}: reliable agent evaluation`,
      canonicalUrl: `https://example.org/${number}`,
    }));
    const query = numbered[0].title;
    expect(
      boardArticles(numbered, { ...initialBoardQuery, q: query }).map(
        (a) => a.id,
      ),
    ).toEqual(["1"]);
    expect(
      (await createArticleSearchEngine(numbered, "blog").search(query)).results,
    ).toHaveLength(1);
  });
  it("shares multi-term and Unicode matching with the board and keeps content types separate", async () => {
    const engine = createArticleSearchEngine(articles, "blog");
    const hits = await engine.search("ＡＩ latency");
    expect(
      await Promise.all(
        hits.results.map(async (hit) => (await hit.data()).url),
      ),
    ).toEqual(["/articles/blog-a/"]);
    expect(
      boardArticles(articles, { ...initialBoardQuery, q: "ＡＩ latency" }).map(
        (a) => a.id,
      ),
    ).toEqual(["blog-a"]);
    expect(
      (await createArticleSearchEngine(articles, "paper").search("Redis"))
        .results,
    ).toHaveLength(1);
    expect((await engine.search("携程")).results).toHaveLength(1);
    expect((await engine.search("  ")).results).toEqual([]);
  });
  it("escapes original markup and regex punctuation while highlighting metadata", () => {
    expect(
      searchExcerpt('<script>alert("x")</script> C++ Redis', ["c++", "redis"]),
    ).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; <mark>C++</mark> <mark>Redis</mark>",
    );
    expect(
      searchExcerpt("a.b [word] (test) $5", ["a.b", "[word]", "(test)", "$5"]),
    ).toBe(
      "<mark>a.b</mark> <mark>[word]</mark> <mark>(test)</mark> <mark>$5</mark>",
    );
  });
  it("ignores stale replies and disposed sessions, and retries failed initialization", async () => {
    vi.useFakeTimers();
    let resolveOld!: (
      value: Awaited<ReturnType<SearchEngine["search"]>>,
    ) => void;
    const engine: SearchEngine = {
      init: async () => {},
      search: vi.fn(async (query: string) =>
        query === "old"
          ? await new Promise<Awaited<ReturnType<SearchEngine["search"]>>>(
              (resolve) => {
                resolveOld = resolve;
              },
            )
          : {
              results: [
                {
                  data: async () => ({
                    url: query,
                    excerpt: query,
                    meta: { title: query, type: "博文" },
                  }),
                },
              ],
            },
      ),
    };
    const loader = vi
      .fn()
      .mockRejectedValueOnce(Error("offline"))
      .mockResolvedValue(engine);
    const session = new SearchSession(loader);
    await session.initialize();
    expect(session.getSnapshot().error).toBe(true);
    session.setQuery("old");
    session.retry();
    await vi.advanceTimersByTimeAsync(300);
    session.setQuery("new");
    await vi.advanceTimersByTimeAsync(300);
    expect(session.getSnapshot().results[0].url).toBe("new");
    resolveOld({ results: [] });
    await vi.advanceTimersByTimeAsync(1);
    expect(session.getSnapshot().results[0].url).toBe("new");
    session.selectNext(1);
    expect(session.getSnapshot().activeIndex).toBe(0);
    session.setQuery("disposed");
    session.dispose();
    await vi.advanceTimersByTimeAsync(301);
    expect(session.getSnapshot().results).toEqual([]);
  });
});
