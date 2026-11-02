import { describe, expect, it } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  sourceReplacements,
  validateSourceReplacements,
} from "../../packages/source-registry/replacements.js";
import { retireReplacedSources } from "../../packages/database/retire-sources.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { validateRelations } from "../../packages/database/snapshot.js";
import type { Article, SourceState } from "../../packages/shared/types.js";

const registry = await loadRegistry();
function fixture() {
  const articles: Article[] = [];
  const replacement = registry.sources.find((s) => s.id === "dewu-csdn")!;
  upsert(
    articles,
    {
      title: "Current engineering practice",
      url: "https://blog.csdn.net/SmartCodeTech/article/details/123",
      externalId: "123",
    },
    replacement,
    registry,
  );
  const old = structuredClone(articles[0]);
  old.id = "00000000000000000001";
  old.locations = [
    { sourceId: "dewu-official", url: "https://tech.dewu.com/article?id=old" },
  ];
  articles[0].duplicateCandidates = [old.id];
  const states: SourceState[] = [
    {
      sourceId: "dewu-official",
      status: "suspended",
      discovered: 1,
      consecutiveFailures: 0,
    },
    {
      sourceId: replacement.id,
      status: "success",
      lastSuccessAt: "2026-11-01T12:00:00Z",
      discovered: 1,
      consecutiveFailures: 0,
    },
  ];
  return { articles: [...articles, old], states };
}
describe("explicit source retirement", () => {
  it("retires Xiaomi's old blog and reference states without changing MiMo articles or IDs", () => {
    const source = registry.sources.find((s) => s.id === "xiaomi-tech-site")!;
    const articles: Article[] = [];
    for (let i = 0; i < 15; i++)
      upsert(
        articles,
        {
          title: `MiMo official blog ${i}`,
          url: `https://mimo.xiaomi.com/zh/blog/mimo-test-${i}`,
          externalId: `mimo-test-${i}`,
        },
        source,
        registry,
      );
    const old = structuredClone(articles[0]);
    old.id = "00000000000000000003";
    old.locations = [
      {
        sourceId: "xiaomi-team-blog",
        url: "https://xiaomi-info.github.io/2020/05/24/post/",
      },
    ];
    articles[0].locations.push(old.locations[0]);
    const states: SourceState[] = [
      ...["xiaomi", "xiaomi-juejin", "xiaomi-csdn-candidate"].map(
        (sourceId) => ({
          sourceId,
          status: "reference" as const,
          discovered: 0,
          consecutiveFailures: 0,
        }),
      ),
      {
        sourceId: "xiaomi-team-blog",
        status: "suspended",
        discovered: 20,
        consecutiveFailures: 0,
      },
      {
        sourceId: source.id,
        status: "success",
        discovered: 15,
        consecutiveFailures: 0,
        lastSuccessAt: "2026-11-02T02:28:18.457Z",
      },
    ];
    const ids = articles.map((a) => a.id);
    const result = retireReplacedSources([...articles, old], states, registry);
    expect(result.articles.map((a) => a.id)).toEqual(ids);
    expect(result.removedArticles).toBe(1);
    expect(result.removedStates).toBe(4);
    expect(
      result.articles.every((a) =>
        a.locations.every((l) => l.sourceId === source.id),
      ),
    ).toBe(true);
    expect(result.states.map((s) => s.sourceId)).toEqual([source.id]);
    validateRelations(result.articles, result.states, registry);
    expect(() =>
      retireReplacedSources(
        [...articles, old],
        states.filter((s) => s.sourceId !== source.id),
        registry,
      ),
    ).toThrow("successful collected article");
  });
  it("removes only retired-source articles and states, preserving IDs and other history", () => {
    const data = fixture();
    const history = structuredClone(data.articles[0]);
    history.id = "00000000000000000002";
    history.publisherId = "oppo-official";
    history.companyId = "oppo";
    history.locations = [
      {
        sourceId: "oppo-segmentfault",
        url: "https://segmentfault.com/a/1190000040000001",
      },
    ];
    data.articles.push(history);
    const before = structuredClone(data);
    const result = retireReplacedSources(data.articles, data.states, registry);
    expect(result.removedArticles).toBe(1);
    expect(result.removedStates).toBe(1);
    expect(result.articles.map((a) => a.id)).toEqual([
      before.articles[0].id,
      history.id,
    ]);
    expect(result.articles[0].duplicateCandidates).toEqual([]);
    expect(data).toEqual(before);
    validateRelations(result.articles, result.states, registry);
    const again = retireReplacedSources(
      result.articles,
      result.states,
      registry,
    );
    expect(
      again.removedArticles + again.removedStates + again.removedLocations,
    ).toBe(0);
    expect(again.articles).toEqual(result.articles);
  });
  it("keeps a cross-platform article when another registered location remains", () => {
    const data = fixture();
    data.articles[0].locations.push(data.articles[1].locations[0]);
    const result = retireReplacedSources(
      data.articles.slice(0, 1),
      data.states,
      registry,
    );
    expect(result.removedArticles).toBe(0);
    expect(result.removedLocations).toBe(1);
    expect(result.articles[0].id).toBe(data.articles[0].id);
    validateRelations(result.articles, result.states, registry);
  });
  it("fails without collected replacement evidence and does not mutate the snapshot", () => {
    const data = fixture();
    const before = structuredClone(data);
    expect(() =>
      retireReplacedSources(
        data.articles,
        data.states.filter((s) => s.sourceId !== "dewu-csdn"),
        registry,
      ),
    ).toThrow("successful collected article");
    expect(() =>
      retireReplacedSources(data.articles.slice(1), data.states, registry),
    ).toThrow("successful collected article");
    const disabled = structuredClone(registry);
    disabled.sources.find((s) => s.id === "dewu-csdn")!.crawl.enabled = false;
    expect(() =>
      retireReplacedSources(data.articles, data.states, disabled),
    ).toThrow("verified and enabled");
    expect(data).toEqual(before);
  });
  it("rejects missing or wrong-company replacements and confirms all retired channels are absent", () => {
    for (const rule of sourceReplacements)
      expect(registry.sources.some((s) => s.id === rule.sourceId)).toBe(false);
    const wrong = structuredClone(registry);
    wrong.sources.find((s) => s.id === "dewu-csdn")!.publisherId =
      "tencent-official";
    expect(() => validateSourceReplacements(wrong)).toThrow("same company");
    expect(() =>
      validateSourceReplacements({
        ...registry,
        sources: registry.sources.filter((s) => s.id !== "dewu-csdn"),
      }),
    ).toThrow("same company");
  });
});
