import { expect, it } from "vitest";
import { assessContentSignals } from "../../packages/classifier/content-signals.js";
import {
  boardArticles,
  boardSearch,
  readBoardQuery,
} from "../../apps/web/src/board.js";
import type { Article } from "../../packages/shared/types.js";

const assess = (title: string, description?: string) =>
  assessContentSignals({ title, description });
it("separates form hints from AI technical hints without treating releases as noise", () => {
  expect(assess("CFP 开放丨Agent 大模型推理").kinds).toEqual([
    "activity",
    "ai-technical",
  ]);
  expect(assess("如何使用 AI Agent 的 MCP 接入").kinds).toEqual([
    "tutorial",
    "ai-technical",
  ]);
  expect(assess("CVPR 2026：4K 图像编辑数据集").kinds).toContain("research");
  expect(assess("Qwen 模型全新发布").kinds).toEqual(["review"]);
});
it("does not hide engineering articles about registration or promotions", () => {
  for (const title of [
    "活动报名系统架构设计",
    "红包封面生成算法",
    "抽奖系统的 AI 风控架构",
  ]) {
    expect(assess(title).kinds).not.toContain("activity");
  }
  expect(assess("好看的2026中秋红包封面来抢！！").kinds).toContain("activity");
  expect(assess("快手技术沙龙报名｜Data Agent").kinds).toContain("activity");
  expect(assess("AI 推理架构", "欢迎参与抽奖").kinds).not.toContain("activity");
});
it("keeps missing material unknown and can recognize engineering evidence in summaries", () => {
  expect(assess("beanutils 故障复盘").kinds).toEqual(["review"]);
  const result = assess(
    "beanutils 故障复盘",
    "通过 AI 辅助定位与回归验证修复空值转换问题",
  );
  expect(result.kinds).toContain("ai-technical");
  expect(result.evidence.some((e) => e.field === "description")).toBe(true);
  expect(result.reason).toContain("未审核全文");
  expect(assess("AI 工具").kinds).toEqual(["review"]);
});
it("bounds evidence and never changes admission or publication fields", () => {
  const article = {
    title: "AI 推理调度",
    description: "x".repeat(500) + "大模型缓存",
    classification: { status: "accepted" },
    publicationStatus: "published",
  };
  const before = JSON.stringify(article);
  expect(
    assessContentSignals(article).evidence.every((e) => e.text.length <= 160),
  ).toBe(true);
  expect(JSON.stringify(article)).toBe(before);
});
it("filters only on explicit opt-in and shares/restores the choice through the URL", () => {
  const articles = [
    { id: "a", title: "红包封面来抢", discoveredAt: "2026-11-02T00:00:00Z" },
    {
      id: "b",
      title: "beanutils 故障复盘",
      discoveredAt: "2026-11-02T00:00:00Z",
    },
    {
      id: "c",
      title: "如何使用 MCP 与 AI Agent",
      discoveredAt: "2026-11-02T00:00:00Z",
    },
  ] as Article[];
  const query = readBoardQuery("", []);
  expect(boardArticles(articles, query)).toHaveLength(3);
  const filtered = { ...query, hideActivities: true };
  expect(boardArticles(articles, filtered).map((a) => a.id)).toEqual([
    "c",
    "b",
  ]);
  expect(readBoardQuery(boardSearch(filtered), [])).toEqual(filtered);
  expect(
    boardArticles(articles, { ...query, hideActivities: false }),
  ).toHaveLength(3);
  expect(readBoardQuery("?hide=anything", [])).toEqual(query);
});
