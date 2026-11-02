import { describe, it, expect, vi } from "vitest";
import * as cheerio from "cheerio";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ArticleParser,
  articleParser,
} from "../../packages/article-parser/index.js";
import { parserRuleSchema } from "../../packages/article-parser/types.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { collectBodies } from "../../packages/crawler/bodies.js";
import {
  saveSnapshot,
  loadSnapshot,
  digest,
} from "../../packages/database/snapshot.js";
import type { Article } from "../../packages/shared/types.js";
import type { ArticleBody } from "../../packages/shared/article-body.js";
import { exportSite } from "../../packages/publisher/export.js";

const text =
  "正文内容介绍工程实践、适用条件与实现方法，保留来源说明和代码示例。".repeat(
    10,
  );
const url = "https://www.cnblogs.com/Jcloud/p/22824796";
const parse = (html: string) =>
  articleParser.parse({
    url,
    content: `<title>文章标题</title><div id="cnblogs_post_body">${html}</div>`,
  });
const registry = await loadRegistry();
const source = registry.sources.find((source) => source.id === "meituan")!;
function makeArticles() {
  const articles: Article[] = [];
  upsert(
    articles,
    {
      title: "真实来源的工程实践",
      url: "https://tech.meituan.com/reader-test.html",
      description: "简短介绍",
    },
    source,
    registry,
  );
  return articles;
}

describe("declarative article parser", () => {
  it("matches exact hosts and paths and supports independent rule registration", () => {
    expect(articleParser.match(url)?.id).toBe("cnblogs");
    expect(
      articleParser.match("https://www.cnblogs.com.evil.test/a"),
    ).toBeUndefined();
    const parser = new ArticleParser([
      parserRuleSchema.parse({
        id: "custom",
        version: "2",
        hosts: ["example.com"],
        include: ["#body"],
        exclude: [".ad"],
      }),
    ]);
    const result = parser.parse({
      url: "https://example.com/a",
      content: `<div id="body"><div class="ad">广告</div><p>${text}</p></div>`,
    });
    expect(result.ruleId).toBe("custom");
    expect(result.ruleVersion).toBe("2");
    expect(result.html).not.toContain("广告");
    expect(() =>
      parserRuleSchema.parse({
        id: "bad",
        hosts: ["example.com"],
        include: ["#body"],
        javascript: "evil()",
      }),
    ).toThrow();
  });
  it("removes active HTML and publisher formatting while preserving tables, code, relative links and lazy images", () => {
    const result = parse(
      `<p style="color:red" onclick="bad()">${text}<script>bad()</script><iframe src="/x"></iframe><svg onload="bad()"></svg></p><pre><code class="language-ts" onmouseover="bad()">const x = &lt;1;</code></pre><table><tr><td>数据</td></tr></table><a href="../reference">参考</a><a href="javascript:bad()">无效链接</a><img src="placeholder.gif" data-src="/image.png" onerror="bad()" alt="架构图"><p style="background:url(https://tracker.test)">结束</p>`,
    );
    const $ = cheerio.load(result.html);
    expect(
      $("script,iframe,svg,[style],[onclick],[onerror],[onmouseover]").length,
    ).toBe(0);
    expect($("pre code").text()).toBe("const x = <1;");
    expect($("pre code").attr("class")).toBe("language-ts");
    expect($(".markdown-table-wrap table").length).toBe(1);
    expect($("a").first().attr("href")).toBe(
      "https://www.cnblogs.com/Jcloud/reference",
    );
    expect($("a").eq(1).attr("href")).toBeUndefined();
    expect($("img").attr("src")).toBe("https://www.cnblogs.com/image.png");
    expect($("img").attr("loading")).toBe("lazy");
  });
  it("creates collision-free heading IDs and repairs article fragment links", () => {
    const result = parse(
      `<a href="#old">跳转</a><h2 id="old">章节</h2><p>${text}</p><h2>章节</h2><h3>子节</h3><div id="main">结尾</div>`,
    );
    expect(result.headings.map((heading) => heading.id)).toEqual([
      "section-章节",
      "section-章节-2",
      "section-子节",
    ]);
    const $ = cheerio.load(result.html);
    expect($("a").first().attr("href")).toBe("#section-章节");
    expect($("#main").length).toBe(0);
  });
  it("drops active URLs to private IPv4 and IPv6 addresses while keeping code examples", () => {
    const result = parse(
      `<p>${text}</p><pre>http://127.0.0.1:5001</pre><img src="http://[fd00::1]/image.png"><img src="http://100.64.0.1/image.png"><img src="http://0.0.0.1/image.png"><a href="http://[::ffff:127.0.0.1]/">private</a>`,
    );
    const $ = cheerio.load(result.html);
    expect($("img,a[href]").length).toBe(0);
    expect($("pre").text()).toBe("http://127.0.0.1:5001");
  });
  it("rejects shells for known sites and keeps generic extraction explicitly partial", () => {
    expect(() =>
      articleParser.parse({ url, content: `<main><p>${text}</p></main>` }),
    ).toThrow("No body matched");
    expect(() => parse("<p>登录</p>")).toThrow();
    const result = articleParser.parse({
      url: "https://unknown.example/post",
      content: `<article><h1>标题</h1><p>${text}</p><p>${text}</p></article>`,
    });
    expect(result.status).toBe("partial");
    expect(result.ruleId).toBe("readability");
  });
  it("reads markdown embedded in Tencent JSON without executing scripts and checks article identity", () => {
    const data = {
      props: {
        pageProps: {
          fallback: {
            '#url:"/api/article/detail",params:#articleId:123,,': {
              articleInfo: {
                articleId: 123,
                content: `## 章节\n\n${text}\n\n<script>evil()</script>`,
              },
            },
          },
        },
      },
    };
    const content = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;
    const result = articleParser.parse({
      url: "https://developer.cloud.tencent.com/article/123",
      content,
    });
    expect(result.ruleId).toBe("tencent-article-json");
    expect(result.html).not.toContain("evil()");
    expect(result.headings).toHaveLength(1);
    expect(() =>
      articleParser.parse({
        url: "https://developer.cloud.tencent.com/article/12",
        content,
      }),
    ).toThrow();
  });
  it("decodes Lake strings and image cards as data, without evaluating assignments", () => {
    const image = `<card name="image" value="data:${encodeURIComponent(JSON.stringify({ src: "https://cdn.example/image.png" }))}"></card>`;
    const lake = `<p>${text}</p>${image}`;
    const content = `<script>throw new Error('must not run'); GLOBAL_CONFIG.larkContent = ${JSON.stringify(lake)};</script>`;
    const result = articleParser.parse({
      url: "https://developer.aliyun.com/article/1",
      content,
    });
    expect(result.ruleId).toBe("aliyun-lake");
    expect(result.html).toContain("https://cdn.example/image.png");
    expect(result.html).not.toContain("must not run");
  });
  it("marks explicit truncation and accepts an image-led article", () => {
    expect(parse(`<p>${text}</p><p>本文仅展示部分内容</p>`).status).toBe(
      "partial",
    );
    const result = parse(
      '<p>架构说明</p><img src="/one.png"><img src="/two.png">',
    );
    expect(result.status).toBe("ready");
  });
  it("restores Lake table cards and marks unsupported embeds as partial", () => {
    const table = `<card name="table" value="data:${encodeURIComponent(JSON.stringify({ html: '<table><tr><td style="color:red">表格内容<script>bad()</script></td></tr></table>' }))}"></card>`;
    const content = `<script>GLOBAL_CONFIG.larkContent = ${JSON.stringify(`<p>${text}</p>${table}<card name="hr"></card>`)};</script>`;
    const result = articleParser.parse({
      url: "https://developer.aliyun.com/article/1",
      content,
    });
    expect(result.ruleVersion).toBe("2");
    const $ = cheerio.load(result.html);
    expect($("table td").text()).toBe("表格内容");
    expect($("hr").length).toBe(1);
    expect(result.status).toBe("ready");
    expect($("script,[style]").length).toBe(0);
    const unsupported = articleParser.parse({
      url: "https://developer.aliyun.com/article/1",
      content: `<script>GLOBAL_CONFIG.larkContent = ${JSON.stringify(`<p>${text}</p><card name="unknown" value="data:%7B%7D"></card>`)};</script>`,
    });
    expect(unsupported.status).toBe("partial");
  });
  it("renders publisher token blocks and media shortcodes through the same sanitizer", () => {
    const result = articleParser.parse({
      url: "https://docs.qwenlm.ai/research/test/index.json",
      format: "markdown-tokens",
      fragment: true,
      content: JSON.stringify([
        { type: "heading", raw: "## 工程实现\n\n" },
        { type: "hr" },
        { type: "paragraph", raw: `${text}\n\n` },
        {
          type: "hugoFigure",
          raw: "{{< figure >}}",
          src: "/diagram.png",
          caption: "架构图",
        },
        { type: "html", raw: "<script>evil()</script>" },
      ]),
    });
    expect(result.headings[0].text).toBe("工程实现");
    expect(result.html).toContain("https://docs.qwenlm.ai/diagram.png");
    expect(result.html).not.toContain("evil()");
    expect(result.sourceUrl).toContain("index.json");
  });
});

describe("body collection and durable snapshots", () => {
  it("uses the new rule's completeness status when replacing a body from an older rule", async () => {
    const articles = makeArticles();
    const parsed = articleParser.parse({
      url: articles[0].canonicalUrl,
      fragment: true,
      content: `<p>${text}</p>`,
    });
    const first = await collectBodies(articles, [], registry, {
      loader: async () => parsed,
    });
    const old = { ...first.bodies[0], ruleId: "meituan", ruleVersion: "0" };
    const result = await collectBodies(articles, [old], registry, {
      loader: async () => ({
        ...parsed,
        ruleId: "meituan",
        ruleVersion: "1",
        status: "partial",
        warnings: ["正文不完整"],
      }),
    });
    expect(result.bodies[0].status).toBe("partial");
    expect(result.bodies[0].ruleVersion).toBe("1");
  });
  it("retains a successful body when a refresh fails, and respects retry dates", async () => {
    const articles = makeArticles();
    const parsed = articleParser.parse({
      url: articles[0].canonicalUrl,
      content: `<p>${text}</p>`,
      fragment: true,
    });
    const first = await collectBodies(articles, [], registry, {
      loader: async () => parsed,
    });
    const loader = vi.fn(async () => {
      throw new Error("temporarily unavailable");
    });
    const skipped = await collectBodies(articles, first.bodies, registry, {
      loader,
    });
    expect(skipped.attempted).toBe(0);
    expect(loader).not.toHaveBeenCalled();
    const retry = await collectBodies(articles, first.bodies, registry, {
      force: true,
      loader,
    });
    expect(retry.bodies[0].status).toBe("ready");
    expect(retry.bodies[0].html).toBe(first.bodies[0].html);
    expect(retry.bodies[0].fetchedAt).toBe(first.bodies[0].fetchedAt);
    expect(retry.bodies[0].error).toBe("temporarily unavailable");
  });
  it("does not fetch papers or hidden articles, and records failures without dropping index entries", async () => {
    const articles = makeArticles();
    const loader = vi.fn(async () => {
      throw new Error("HTTP 403");
    });
    const result = await collectBodies(articles, [], registry, { loader });
    expect(result.bodies[0].status).toBe("unavailable");
    expect(result.bodies[0].html).toBe("");
    expect(articles).toHaveLength(1);
    await collectBodies(
      [
        { ...articles[0], contentType: "paper" },
        { ...articles[0], publicationStatus: "hidden" },
      ],
      [],
      registry,
      { loader },
    );
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it("roundtrips bodies, reads legacy snapshots and detects body corruption", async () => {
    const dir = await mkdtemp(join(tmpdir(), "radar-reader-"));
    try {
      const articles = makeArticles();
      const result = await collectBodies(articles, [], registry, {
        loader: async () =>
          articleParser.parse({
            url: articles[0].canonicalUrl,
            content: `<p>${text}</p>`,
            fragment: true,
          }),
      });
      await saveSnapshot(dir, articles, [], registry, result.bodies);
      expect((await loadSnapshot(dir, registry)).bodies).toEqual(result.bodies);
      await saveSnapshot(dir, articles, [], registry);
      expect((await loadSnapshot(dir, registry)).bodies).toEqual(result.bodies);
      const manifest = JSON.parse(
        await readFile(join(dir, "manifest.json"), "utf8"),
      );
      expect(manifest.schemaVersion).toBe(2);
      await writeFile(join(dir, "bodies", `${articles[0].id}.json`), "{}");
      await expect(loadSnapshot(dir, registry)).rejects.toThrow("checksum");
      delete manifest.files[`bodies/${articles[0].id}.json`];
      manifest.schemaVersion = 1;
      delete manifest.bodyCount;
      await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
      expect((await loadSnapshot(dir, registry)).bodies).toEqual([]);
      const invalid: ArticleBody = {
        ...result.bodies[0],
        contentHash: digest("wrong"),
      };
      await expect(
        saveSnapshot(dir, articles, [], registry, [invalid]),
      ).rejects.toThrow("checksum");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("exports single-article bodies without adding full text to the board or feeds, and removes hidden body exports", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-reader-export-"));
    try {
      const articles = makeArticles();
      const result = await collectBodies(articles, [], registry, {
        loader: async () =>
          articleParser.parse({
            url: articles[0].canonicalUrl,
            content: `<p>${text}</p>`,
            fragment: true,
          }),
      });
      const snapshot = {
        articles,
        states: [],
        bodies: result.bodies,
        manifest: {
          schemaVersion: 2 as const,
          generatedAt: new Date().toISOString(),
          articleCount: 1,
          sourceCount: 0,
          bodyCount: 1,
          files: {},
        },
      };
      await exportSite(snapshot, registry, root, "https://example.org/radar");
      expect(
        await readFile(join(root, "apps/web/src/generated/site.json"), "utf8"),
      ).not.toContain(text);
      expect(
        await readFile(join(root, "apps/web/public/feed.xml"), "utf8"),
      ).not.toContain(text);
      expect(
        await readFile(
          join(root, `apps/web/src/generated/bodies/${articles[0].id}.json`),
          "utf8",
        ),
      ).toContain(text);
      articles[0].publicationStatus = "hidden";
      await exportSite(snapshot, registry, root, "https://example.org/radar");
      await expect(
        readFile(
          join(root, `apps/web/public/data/bodies/${articles[0].id}.json`),
          "utf8",
        ),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
