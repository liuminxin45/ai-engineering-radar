import { describe, expect, it } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  sourceReplacements,
  validateSourceReplacements,
} from "../../packages/source-registry/replacements.js";
import { retireReplacedSources } from "../../packages/database/retire-sources.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { validateRelations } from "../../packages/database/snapshot.js";
import { parseCrossref } from "../../packages/crawler/platforms/papers.js";
import type { Article, SourceState } from "../../packages/shared/types.js";

const registry = await loadRegistry();
function fixture() {
  const articles: Article[] = [];
  const replacement = registry.sources.find((s) => s.id === "dewu-tencent")!;
  upsert(
    articles,
    {
      title: "Current engineering practice",
      url: "https://developer.cloud.tencent.com/article/123",
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
  it("withdraws disabled and blocked sources without withdrawing their companies or working papers", () => {
    const source = registry.sources.find(
      (s) => s.id === "alibaba-papers-crossref",
    )!;
    const articles: Article[] = [];
    upsert(
      articles,
      parseCrossref(
        JSON.stringify({
          status: "ok",
          message: {
            items: [
              {
                DOI: "10.1234/retained",
                type: "proceedings-article",
                title: ["Retained company paper"],
                author: [{ affiliation: [{ name: "Alibaba Group" }] }],
              },
            ],
          },
        }),
        source,
        "alibaba",
      )[0],
      source,
      registry,
    );
    const retained = articles[0];
    const old = structuredClone(retained);
    old.id = "00000000000000000009";
    old.publisherId = "aliyun-cloud-native";
    old.locations = [
      {
        sourceId: "aliyun-cloud-native",
        url: "https://developer.aliyun.com/article/123",
      },
    ];
    const states: SourceState[] = [
      {
        sourceId: source.id,
        status: "success",
        discovered: 1,
        consecutiveFailures: 0,
      },
      {
        sourceId: "aliyun-cloud-native",
        status: "blocked",
        discovered: 0,
        consecutiveFailures: 1,
      },
      {
        sourceId: "qwen-hf-papers",
        status: "reference",
        discovered: 0,
        consecutiveFailures: 0,
      },
    ];
    const result = retireReplacedSources([retained, old], states, registry);
    expect(result.articles.map((a) => a.id)).toEqual([retained.id]);
    expect(result.states.map((s) => s.sourceId)).toEqual([source.id]);
    expect(result.removedArticles).toBe(1);
    expect(result.removedStates).toBe(2);
    expect(registry.companies.some((c) => c.id === "alibaba")).toBe(true);
    validateRelations(result.articles, result.states, registry);
    expect(
      retireReplacedSources(result.articles, result.states, registry)
        .removedArticles,
    ).toBe(0);
  });
  it.each([
    {
      companyId: "xiaomi",
      sourceId: "xiaomi-tech-site",
      publisherId: "xiaomi-official",
    },
    {
      companyId: "xiaomi",
      sourceId: "xiaomi-papers-crossref",
      publisherId: "xiaomi-research-papers",
    },
    {
      companyId: "xiaomi",
      sourceId: "mimo-hf-papers",
      publisherId: "xiaomi-research-papers",
    },
    {
      companyId: "oppo",
      sourceId: "oppo-segmentfault",
      publisherId: "oppo-official",
    },
    {
      companyId: "xiaohongshu",
      sourceId: "xiaohongshu-csdn",
      publisherId: "xiaohongshu-official",
    },
  ])(
    "withdraws $companyId articles and states without a replacement and preserves other companies",
    ({ companyId, sourceId, publisherId }) => {
      const data = fixture();
      const current = structuredClone(data.articles[0]);
      const withdrawn = structuredClone(current);
      withdrawn.id = "00000000000000000005";
      withdrawn.companyId = companyId;
      withdrawn.publisherId = publisherId;
      withdrawn.locations = [
        {
          sourceId,
          url: "https://segmentfault.com/a/1190000040000001",
        },
      ];
      current.duplicateCandidates = [withdrawn.id];
      const articles = [current, withdrawn];
      const states: SourceState[] = [
        data.states[1],
        {
          sourceId: companyId,
          status: "reference",
          discovered: 0,
          consecutiveFailures: 0,
        },
        {
          sourceId,
          status: "suspended",
          discovered: 50,
          consecutiveFailures: 0,
        },
      ];
      const before = structuredClone({ articles, states });
      const result = retireReplacedSources(articles, states, registry);
      expect(result.articles.map((a) => a.id)).toEqual([current.id]);
      expect(result.articles[0].duplicateCandidates).toEqual([]);
      expect(result.removedArticles).toBe(1);
      expect(result.removedStates).toBe(2);
      expect(registry.companies.some((c) => c.id === companyId)).toBe(false);
      expect({ articles, states }).toEqual(before);
      validateRelations(result.articles, result.states, registry);
      expect(
        retireReplacedSources(result.articles, result.states, registry)
          .removedArticles,
      ).toBe(0);
    },
  );
  it("removes empty reference states while preserving a working collector", () => {
    const source = registry.sources.find((s) => s.id === "jd-cnblogs")!;
    const articles: Article[] = [];
    upsert(
      articles,
      {
        title: "Historical engineering article",
        url: "https://www.cnblogs.com/Jcloud/p/123.html",
      },
      source,
      registry,
    );
    const states: SourceState[] = [
      {
        sourceId: "jd",
        status: "reference",
        discovered: 0,
        consecutiveFailures: 0,
      },
      {
        sourceId: source.id,
        status: "success",
        discovered: 1,
        consecutiveFailures: 0,
      },
    ];
    const result = retireReplacedSources(articles, states, registry);
    expect(result.articles).toEqual(articles);
    expect(result.states.map((s) => s.sourceId)).toEqual([source.id]);
    const unexpected = structuredClone(articles[0]);
    unexpected.locations = [
      { sourceId: "jd", url: "https://www.jd.com/article/1" },
    ];
    expect(() => retireReplacedSources([unexpected], states, registry)).toThrow(
      "Reference-only retirement contains article history",
    );
  });

  it("requires collected evidence before removing the other active team source", () => {
    const source = registry.sources.find((s) => s.id === "ant-data-csdn")!;
    const articles: Article[] = [];
    upsert(
      articles,
      {
        title: "AntData engineering article",
        url: "https://blog.csdn.net/DB_GPT/article/details/123",
      },
      source,
      registry,
    );
    const old = structuredClone(articles[0]);
    old.id = "00000000000000000004";
    old.publisherId = "ant-oceanbase";
    old.locations = [
      {
        sourceId: "ant-oceanbase-csdn",
        url: "https://blog.csdn.net/OceanBaseGFBK/article/details/1",
      },
    ];
    const ling = structuredClone(old);
    ling.id = "00000000000000000005";
    ling.publisherId = "ant-ling";
    ling.locations = [
      {
        sourceId: "ant-ling",
        url: "https://developer.ant-ling.com/zh-CN/blogs/example",
      },
    ];
    const states: SourceState[] = [
      {
        sourceId: source.id,
        status: "success",
        discovered: 1,
        consecutiveFailures: 0,
        lastSuccessAt: "2026-11-02T00:52:25Z",
      },
    ];
    expect(() =>
      retireReplacedSources([...articles, old, ling], [], registry),
    ).toThrow("successful collected article");
    const result = retireReplacedSources(
      [...articles, old, ling],
      states,
      registry,
    );
    expect(result.articles.map((a) => a.id)).toEqual([articles[0].id]);
    expect(result.removedArticles).toBe(2);
  });
  it("removes only retired-source articles and states, preserving IDs and other history", () => {
    const data = fixture();
    const history = structuredClone(data.articles[0]);
    history.id = "00000000000000000002";
    history.publisherId = "jd-official";
    history.companyId = "jd";
    history.locations = [
      {
        sourceId: "jd-cnblogs",
        url: "https://www.cnblogs.com/Jcloud/p/123.html",
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
        data.states.filter((s) => s.sourceId !== "dewu-tencent"),
        registry,
      ),
    ).toThrow("successful collected article");
    expect(() =>
      retireReplacedSources(data.articles.slice(1), data.states, registry),
    ).toThrow("successful collected article");
    const disabled = structuredClone(registry);
    disabled.sources.find((s) => s.id === "dewu-tencent")!.crawl.enabled =
      false;
    expect(() =>
      retireReplacedSources(data.articles, data.states, disabled),
    ).toThrow("verified and enabled");
    expect(data).toEqual(before);
  });
  it("rejects missing or wrong-company replacements and confirms all retired channels are absent", () => {
    for (const rule of sourceReplacements)
      expect(registry.sources.some((s) => s.id === rule.sourceId)).toBe(false);
    const wrong = structuredClone(registry);
    wrong.sources.find((s) => s.id === "dewu-tencent")!.publisherId =
      "tencent-official";
    expect(() => validateSourceReplacements(wrong)).toThrow("same company");
    expect(() =>
      validateSourceReplacements({
        ...registry,
        sources: registry.sources.filter((s) => s.id !== "dewu-tencent"),
      }),
    ).toThrow("same company");
  });
});
