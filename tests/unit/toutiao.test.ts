import { describe, expect, it } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  parseToutiaoFeed,
  reviewedToutiaoUrl,
  verifyToutiaoDocument,
} from "../../packages/crawler/platforms/toutiao.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { collectBodies } from "../../packages/crawler/bodies.js";
import { articleParser } from "../../packages/article-parser/index.js";
import type { Article } from "../../packages/shared/types.js";

const registry = await loadRegistry();
const source = registry.sources.find((s) => s.id === "bytedance-tech-toutiao")!;
const url = "https://www.toutiao.com/article/7703892274039669290/";
const item = {
  title: "工程实践",
  link: url,
  author: "字节跳动技术团队",
  description: "摘要",
};

describe("reviewed Toutiao account", () => {
  it("only accepts its account feed, author and article paths", () => {
    const feed = {
      link: source.url,
      item: [
        item,
        { ...item, author: "other" },
        { ...item, link: "https://www.toutiao.com/video/123/" },
      ],
    };
    expect(parseToutiaoFeed(feed, source)).toHaveLength(1);
    expect(() =>
      parseToutiaoFeed({ ...feed, link: "https://example.org/" }, source),
    ).toThrow();
    expect(() =>
      reviewedToutiaoUrl(source, "https://example.org/article/123/"),
    ).toThrow();
  });
  it("requires the author profile and a nonempty article container", () => {
    const valid = `<div class="article-content"><a href="${source.url}">字节跳动技术团队</a><p>正文</p></div>`;
    expect(() => verifyToutiaoDocument(valid, source)).not.toThrow();
    expect(() =>
      verifyToutiaoDocument(
        valid.replace(source.url, "https://example.org/"),
        source,
      ),
    ).toThrow();
    expect(() =>
      verifyToutiaoDocument("<title>access check</title>", source),
    ).toThrow();
  });
  it("refreshes otherwise unchanged bodies before signed images expire", async () => {
    const articles: Article[] = [];
    upsert(articles, { title: "工程实践", url }, source, registry);
    const parsed = articleParser.parse({
      url,
      title: "工程实践",
      fragment: true,
      content: `<p>${"正文内容".repeat(80)}</p>`,
    });
    const loader = async () => parsed;
    const initial = await collectBodies(articles, [], registry, { loader });
    const body = {
      ...initial.bodies[0],
      ruleId: "toutiao",
      ruleVersion: "1",
      html: `<p>正文</p><img src="https://p3-sign.toutiaoimg.com/a?x-expires=${Math.floor(Date.now() / 1000) + 3600}">`,
    };
    const result = await collectBodies(articles, [body], registry, {
      incremental: true,
      loader,
    });
    expect(result.attempted).toBe(1);
  });
});
