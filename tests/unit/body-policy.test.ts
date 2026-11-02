import { describe, expect, it, vi } from "vitest";
import {
  articleParser,
  ENGINE_VERSION,
} from "../../packages/article-parser/index.js";
import { upgradeBodyPolicy } from "../../packages/crawler/body-policy.js";
import { collectBodies } from "../../packages/crawler/bodies.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import type { Article } from "../../packages/shared/types.js";
import { digest } from "../../packages/database/snapshot.js";
const registry = await loadRegistry();
const source = registry.sources.find((s) => s.id === "meituan")!;
function fixture() {
  const articles: Article[] = [];
  upsert(
    articles,
    { title: "一张公告海报", url: "https://tech.meituan.com/poster.html" },
    source,
    registry,
  );
  const parsed = articleParser.parse({
    url: articles[0].canonicalUrl,
    fragment: true,
    content: '<img src="https://example.org/poster.png">',
  });
  return {
    articles,
    body: {
      ...parsed,
      articleId: articles[0].id,
      status: "partial" as const,
      engineVersion: "radar-reader-1",
      sourceId: source.id,
      checkedAt: "2026-11-02T09:00:00.000Z",
      fetchedAt: "2026-11-02T09:00:00.000Z",
      contentHash: digest(parsed.html),
      warnings: ["取得的正文较短，可能不完整。"],
    },
  };
}
describe("body completeness policy migration", () => {
  it("upgrades stored CSDN code offline and refreshes only legacy empty blocks", () => {
    const html =
      '<h2 id="stable">目录<a class="heading-anchor" href="#stable">#</a></h2><pre><code><ol><li><div>const a = 1;</div></li><li><div>const b = 2;</div></li></ol></code></pre>';
    const old = {
      ...fixture().body,
      status: "ready" as const,
      warnings: [],
      engineVersion: ENGINE_VERSION,
      sourceUrl: "https://blog.csdn.net/vivo_tech/article/details/123456",
      ruleId: "csdn",
      ruleVersion: "2",
      html,
      contentHash: digest(html),
    };
    const [migrated] = upgradeBodyPolicy([old]);
    expect(migrated.ruleVersion).toBe("3");
    expect(migrated.html).toContain("const a = 1;\nconst b = 2;");
    expect(migrated.html).toContain('id="stable"');
    expect(migrated.refreshPending).toBeUndefined();
    expect(migrated.fetchedAt).toBe(old.fetchedAt);
    expect(migrated.checkedAt).toBe(old.checkedAt);
    expect(migrated.contentHash).toBe(digest(migrated.html));
    expect(upgradeBodyPolicy([migrated])).toEqual([migrated]);
    const [empty] = upgradeBodyPolicy([
      {
        ...old,
        html: "<p>正文</p><pre></pre>",
        contentHash: digest("<p>正文</p><pre></pre>"),
      },
    ]);
    expect(empty.refreshPending).toBe(true);
  });
  it("promotes only the removed short-body warning while preserving stored content and timestamps", () => {
    const { body } = fixture();
    const [upgraded] = upgradeBodyPolicy([body]);
    expect(upgraded).toMatchObject({
      status: "ready",
      warnings: [],
      engineVersion: ENGINE_VERSION,
      html: body.html,
      contentHash: body.contentHash,
      fetchedAt: body.fetchedAt,
      checkedAt: body.checkedAt,
    });
    expect(upgradeBodyPolicy([upgraded])).toEqual([upgraded]);
    const [restricted] = upgradeBodyPolicy([
      { ...body, warnings: [...body.warnings, "原站提示正文存在阅读限制。"] },
    ]);
    expect(restricted.status).toBe("partial");
    expect(restricted.warnings).toEqual(["原站提示正文存在阅读限制。"]);
  });
  it("does not re-download old successful or reclassified bodies just to update the policy", async () => {
    const { body, articles } = fixture();
    const loader = vi.fn(async () => {
      throw new Error("No network refresh allowed");
    });
    const result = await collectBodies(articles, [body], registry, {
      incremental: true,
      loader,
    });
    expect(result.attempted).toBe(0);
    expect(result.bodies[0].status).toBe("ready");
    expect(loader).not.toHaveBeenCalled();
    const successful = await collectBodies(
      articles,
      [{ ...body, status: "ready", warnings: [] }],
      registry,
      { incremental: true, loader },
    );
    expect(successful.attempted).toBe(0);
    expect(loader).not.toHaveBeenCalled();
  });
});
