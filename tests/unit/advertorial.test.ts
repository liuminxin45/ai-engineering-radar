import { expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assessAdvertorial,
  markAdvertorials,
} from "../../packages/classifier/advertorial.js";
import {
  articleSchema,
  type Article,
  type Snapshot,
} from "../../packages/shared/types.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import {
  publishedArticles,
  exportSite,
} from "../../packages/publisher/export.js";
import { applyOverrides } from "../../packages/crawler/ingest.js";
import { vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const assess = (title: string, description?: string) =>
  assessAdvertorial({ title, description });

it("flags the reported cardholder promotion with a verbatim title excerpt", () => {
  const title = "Visa持卡人请查收！你的专属Token福利来了！";
  const result = assess(title);
  expect(result.status).toBe("suspected");
  expect(result.evidence).toEqual([{ field: "title", text: title }]);
  expect(result.reason).toContain("未判断全文质量");
});

it("flags explicit recruitment and conversion while treating missing excerpts as unknown", () => {
  expect(assess("免费报名｜AI 技术沙龙开启").status).toBe("suspected");
  expect(assess("AI 模型限时免费，立即注册领取优惠").status).toBe("suspected");
  expect(assess("某云 Agent 新版本发布").status).toBe("insufficient");
  expect(assess("全面领先：某云技术实践").status).toBe("insufficient");
});

it("keeps product engineering, open source releases, and incidental footer promotion", () => {
  expect(
    assess(
      "某云数据库架构实践",
      "采用 Raft 保障一致性；p99 延迟降至 12ms，讨论跨区部署的取舍。",
    ).status,
  ).toBe("unmarked");
  expect(
    assess("Kitex v0.10.0 正式发布！", "新版本探索性能优化与开源生态兼容。")
      .status,
  ).toBe("unmarked");
  expect(
    assess(
      "缓存击穿故障复盘",
      "通过缓存隔离避免热键阻塞，p99 延迟降至 20ms。点击注册领取优惠。",
    ).status,
  ).toBe("unmarked");
  expect(
    assess(
      "Visa Token 接口安全设计",
      "持卡人支付鉴权采用 OAuth，说明配置示例和适用条件。",
    ).status,
  ).toBe("unmarked");
  expect(
    assess("活动报名系统架构设计", "使用队列解决瞬时写入瓶颈，附代码示例。")
      .status,
  ).toBe("unmarked");
});

it("requires multiple signals for ambiguous product upgrade announcements", () => {
  expect(assess("某平台全新上线", "提供新的查询功能。").status).toBe(
    "unmarked",
  );
  const result = assess(
    "某平台重磅升级",
    "四大能力赋能企业，数据管理更统一、更智能！",
  );
  expect(result.status).toBe("suspected");
  expect(result.evidence.some((e) => e.field === "description")).toBe(true);
  expect(
    assess("某平台重磅升级", "通过索引减少扫描开销，提供 SQL 配置示例。")
      .status,
  ).toBe("unmarked");
});

it("limits persisted evidence and recalculates automated decisions after metadata changes", () => {
  const before = assess("Token福利来了！");
  const after = assessAdvertorial({
    title: "如何实现 Token 预算调度",
    description: "通过队列解决阻塞，附代码示例。",
    advertorial: before,
  });
  expect(after.status).toBe("unmarked");
  const long = assess(
    "模型介绍",
    `立即注册，限时免费。${"一站式企业服务".repeat(300)}`,
  );
  expect(long.status).toBe("suspected");
  expect(long.evidence.every((e) => e.text.length <= 160)).toBe(true);
});

const registry = await loadRegistry();
function articles() {
  const values: Article[] = [];
  upsert(
    values,
    {
      title: "Visa持卡人请查收！你的专属Token福利来了！",
      url: "https://tech.meituan.com/advertorial-trial-example",
    },
    registry.sources.find((s) => s.id === "meituan")!,
    registry,
  );
  return values;
}

it("roundtrips optional review metadata without changing publication or visibility", () => {
  const values = articles();
  expect(articleSchema.parse(values[0]).advertorial).toBeUndefined();
  const publication = JSON.stringify(values[0].classification);
  markAdvertorials(values);
  expect(articleSchema.parse(values[0]).advertorial?.status).toBe("suspected");
  expect(values[0].publicationStatus).toBe("published");
  expect(JSON.stringify(values[0].classification)).toBe(publication);
  expect(publishedArticles(values, registry)).toHaveLength(1);
});

it("lets manual review clear a flag without changing collection classification", async () => {
  const values = articles();
  const classification = structuredClone(values[0].classification);
  vi.mocked(readFile).mockResolvedValueOnce(
    JSON.stringify({
      schemaVersion: 1,
      articles: {
        [values[0].id]: {
          advertorial: "cleared",
          reason: "人工复核：保留技术分享",
        },
      },
      merges: [],
    }),
  );
  await applyOverrides(values);
  markAdvertorials(values);
  expect(values[0].advertorial?.status).toBe("cleared");
  expect(values[0].advertorial?.method).toBe("manual");
  expect(values[0].classification).toEqual(classification);
  expect(publishedArticles(values, registry)).toHaveLength(1);
  // Removing the override restores the rules, including persisted manual state.
  vi.mocked(readFile).mockResolvedValueOnce(
    JSON.stringify({ schemaVersion: 1, articles: {}, merges: [] }),
  );
  await applyOverrides(values);
  expect(values[0].advertorial?.status).toBe("suspected");
  expect(values[0].advertorial?.method).toBe("rules");
});

it("exports trial labels, evidence and a review report while retaining the article and feed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-advertorial-"));
  const values = articles();
  const snapshot: Snapshot = {
    manifest: {
      schemaVersion: 1,
      generatedAt: "2026-11-02T00:00:00.000Z",
      articleCount: 1,
      sourceCount: 0,
      files: {},
    },
    articles: values,
    states: [],
  };
  try {
    await exportSite(snapshot, registry, dir, "https://example.org/radar");
    const data = JSON.parse(
      await readFile(join(dir, "apps/web/public/data/articles.json"), "utf8"),
    );
    const report = JSON.parse(
      await readFile(
        join(dir, "apps/web/public/data/advertorial-review.json"),
        "utf8",
      ),
    );
    expect(data.articles).toHaveLength(1);
    expect(data.articles[0].advertorial.status).toBe("suspected");
    expect(data.articles[0].contentSignals.basis).toBe("title-description");
    expect(report.mode).toBe("label-only");
    expect(report.suspectedCount).toBe(1);
    expect(report.articles[0].reviewUrl).toContain(
      `${values[0].id}/#advertorial-review`,
    );
    expect(
      await readFile(join(dir, "apps/web/public/feed.atom"), "utf8"),
    ).toContain(values[0].id);
    expect(values[0].advertorial).toBeUndefined();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
