import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { screenArticles } from "../../packages/classifier/ai-screen.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { exportSite } from "../../packages/publisher/export.js";
import type { Article, Snapshot } from "../../packages/shared/types.js";
import { loadRegistry } from "../../packages/source-registry/index.js";

const registry = await loadRegistry();
const source = registry.sources.find((item) => item.id === "meituan")!;
const config = {
  url: "https://example.org/v1/chat/completions",
  model: "test",
  key: "test",
};

function sample(titles: string[]) {
  const articles: Article[] = [];
  titles.forEach((title, i) => {
    upsert(
      articles,
      {
        title,
        description: "摘要不应发送",
        url: new URL(`/ai-test-${i}`, source.entryUrl).href,
      },
      source,
      registry,
    );
  });
  return articles;
}

function answer(value: object) {
  return Response.json({
    choices: [{ message: { content: JSON.stringify(value) } }],
  });
}

it("sends only the title and first 1000 characters, caches valid results and retains them after failures", async () => {
  const [article] = sample(["工程复盘"]);
  const prefix = "实".repeat(998) + " 🧪";
  const body = [
    {
      articleId: article.id,
      status: "ready",
      html: `<p>${prefix}正文末尾</p>`,
    },
  ] as Snapshot["bodies"];
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      expect(JSON.parse(payload.messages[1].content)).toEqual({
        title: article.title,
        excerpt: prefix,
      });
      expect(JSON.stringify(payload)).not.toContain(article.description);
      return answer({
        decision: "keep",
        reason: "engineering-practice",
        evidence: "工程复盘",
      });
    });
  expect(
    await screenArticles([article], body, config, 1, request),
  ).toMatchObject({ attempted: 1, keep: 1 });
  const previous = article.aiScreen;
  expect(
    await screenArticles([article], body, config, 1, request),
  ).toMatchObject({ attempted: 0, keep: 1 });
  article.title += "补充";
  request.mockResolvedValueOnce(
    answer({ decision: "drop", reason: "model", evidence: "正文末尾" }),
  );
  expect(
    await screenArticles([article], body, config, 1, request),
  ).toMatchObject({ failed: 1, pending: 1 });
  request.mockResolvedValueOnce(new Response(null, { status: 429 }));
  expect(
    await screenArticles([article], body, config, 1, request),
  ).toMatchObject({ failed: 1, pending: 1 });
  expect(article.aiScreen).toEqual(previous);
});

it("applies decisions to all exports, strips internal evidence and restores an article by ID", async () => {
  const root = await mkdtemp(join(tmpdir(), "radar-ai-test-"));
  const articles = sample(["AI 工程落地", "某模型发布", "待判标题"]);
  const [keep, drop, pending] = articles;
  await screenArticles([keep, drop], [], config, 2, async (_url, init) => {
    const { title } = JSON.parse(
      JSON.parse(String(init?.body)).messages[1].content,
    );
    return answer(
      title === keep.title
        ? { decision: "keep", reason: "engineering-practice", evidence: title }
        : { decision: "drop", reason: "model", evidence: title },
    );
  });
  const snapshot: Snapshot = {
    manifest: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      articleCount: 3,
      sourceCount: 0,
      files: {},
    },
    articles,
    states: [],
  };
  const exportTo = (overrides?: Map<string, "keep">) =>
    exportSite(
      snapshot,
      registry,
      root,
      "https://example.org/radar",
      overrides,
    );
  const file = (name: string) => readFile(join(root, "apps/web", name), "utf8");
  try {
    vi.stubEnv("RADAR_AI_SCREEN_MODE", "shadow");
    await exportTo();
    expect(await file("public/data/articles.json")).toContain(drop.id);
    vi.stubEnv("RADAR_AI_SCREEN_MODE", "enforce");
    await exportTo();
    for (const name of [
      "src/generated/site.json",
      "public/data/articles.json",
      "public/feed.xml",
      "public/feed.atom",
    ]) {
      const output = await file(name);
      expect(output).toContain(keep.id);
      expect(output).not.toContain(drop.id);
      expect(output).not.toContain(pending.id);
      expect(output).not.toContain("aiScreen");
    }
    await expect(
      file(`public/data/articles/${drop.id}.json`),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await exportTo(new Map([[drop.id, "keep"]]));
    expect(await file(`public/data/articles/${drop.id}.json`)).toContain(
      drop.id,
    );
    drop.publicationStatus = "hidden";
    await exportTo(new Map([[drop.id, "keep"]]));
    await expect(
      file(`public/data/articles/${drop.id}.json`),
    ).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
