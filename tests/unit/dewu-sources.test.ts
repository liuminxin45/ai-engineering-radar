import { describe, expect, it } from "vitest";
import {
  loadRegistry,
  validateAccountScope,
} from "../../packages/source-registry/index.js";
import { parseListing } from "../../packages/crawler/adapters.js";
import { retireReplacedSources } from "../../packages/database/retire-sources.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import type { Article } from "../../packages/shared/types.js";

const registry = await loadRegistry();
const source = registry.sources.find((s) => s.id === "dewu-tencent")!;
const card = (
  author = "9927536",
  link = "/article/2771331",
  time = "2026-10-29 10:45:34",
) => `
  <div class="com-3-article-panel">
    <a href="${link}"><h3 class="com-3-article-panel-title">Jev 工程实践</h3></a>
    <p class="com-3-article-panel-desc">轻量决策层</p>
    <a class="author" href="/user/${author}">得物技术</a>
    <time datetime="${time}"></time>
  </div>`;

describe("Tencent Cloud Developer source", () => {
  it("keeps its own identity and accepts only its account's articles", () => {
    const cloud = registry.sources.find(
      (s) => s.id === "tencent-cloud-developer",
    )!;
    expect(
      registry.publishers.find((p) => p.id === cloud.publisherId)?.companyId,
    ).toBe("tencent");
    expect(registry.companies.find((c) => c.id === "tencent")?.name).toBe(
      "腾讯",
    );
    expect(
      registry.publishers.find((p) => p.id === "tencent-official")?.name,
    ).toBe("腾讯技术");
    expect(
      registry.publishers.find((p) => p.id === cloud.publisherId)?.name,
    ).toBe("腾讯云开发者");
    expect(cloud.authorAllowlist).toEqual(["1422024"]);
    expect(parseListing(card("1422024") + card("9927536"), cloud)).toHaveLength(
      1,
    );
    expect(() =>
      validateAccountScope({ ...cloud, authorAllowlist: ["9927536"] }),
    ).toThrow();
  });
});

describe("Dewu's single Tencent Cloud source", () => {
  it("keeps only the requested directory and rejects mismatched account scopes", () => {
    const publishers = registry.publishers
      .filter((p) => p.companyId === "dewu")
      .map((p) => p.id);
    expect(
      registry.sources
        .filter(
          (s) =>
            publishers.includes(s.publisherId) && s.contentType !== "paper",
        )
        .map((s) => s.id),
    ).toEqual([source.id]);
    expect(source.url).toBe(
      "https://developer.cloud.tencent.com/user/9927536/articles",
    );
    expect(source.crawl.enabled).toBe(true);
    for (const patch of [
      { url: "https://developer.cloud.tencent.com/user/123/articles" },
      { authorAllowlist: ["得物技术"] },
      { url: "https://developer.cloud.tencent.com/column/96340" },
    ])
      expect(() => validateAccountScope({ ...source, ...patch })).toThrow();
  });

  it("checks each card's author and article host, deduplicates and uses Beijing publication time", () => {
    const items = parseListing(
      card() +
        card() +
        card("123") +
        card("9927536", "https://other.example/article/12"),
      source,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://developer.cloud.tencent.com/article/2771331",
      externalId: "2771331",
      publishedAt: "2026-10-29T02:45:34.000Z",
      description: "轻量决策层",
    });
    expect(
      parseListing(card("9927536", "/article/1", "invalid"), source)[0]
        .publishedAt,
    ).toBeUndefined();
  });

  it("removes CSDN-only history while retaining articles with a Tencent location", () => {
    const articles: Article[] = [];
    upsert(
      articles,
      {
        title: "Current",
        url: "https://developer.cloud.tencent.com/article/2771331",
        externalId: "2771331",
      },
      source,
      registry,
    );
    const oldLocation = {
      sourceId: "dewu-csdn",
      url: "https://blog.csdn.net/SmartCodeTech/article/details/123",
    };
    const old = structuredClone(articles[0]);
    old.id = "00000000000000000001";
    old.locations = [oldLocation];
    articles[0].locations.push(oldLocation);
    const result = retireReplacedSources(
      [...articles, old],
      [
        {
          sourceId: source.id,
          status: "success",
          discovered: 20,
          consecutiveFailures: 0,
          lastSuccessAt: "2026-11-02T02:52:20Z",
        },
        {
          sourceId: "dewu-csdn",
          status: "success",
          discovered: 20,
          consecutiveFailures: 0,
        },
      ],
      registry,
    );
    expect(result.removedArticles).toBe(1);
    expect(result.removedLocations).toBe(2);
    expect(result.articles[0].id).toBe(articles[0].id);
    expect(result.articles[0].locations.map((l) => l.sourceId)).toEqual([
      source.id,
    ]);
    expect(result.states.map((s) => s.sourceId)).toEqual([source.id]);
  });
});
