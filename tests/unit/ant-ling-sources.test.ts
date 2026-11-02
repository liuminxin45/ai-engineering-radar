import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { Source } from "../../packages/shared/types.js";
import { parseAntLingBlog } from "../../packages/crawler/platforms/ant-ling.js";

const source: Source = {
  id: "ant-ling",
  publisherId: "ant-official",
  name: "蚂蚁百灵博客",
  entryUrl: "https://developer.ant-ling.com/zh-CN/blogs",
  url: "https://developer.ant-ling.com/zh-CN/blogs",
  priority: "A",
  adapter: "html",
  platform: "ant-ling-blog",
  authorAllowlist: ["ant-ling"],
  verification: {
    status: "verified",
    evidenceUrls: ["https://developer.ant-ling.com/zh-CN/blogs"],
    note: "蚂蚁百灵自有开发者站点官方技术博客目录。",
    reviewedAt: "2026-11-02T00:00:00Z",
  },
  crawl: {
    enabled: true,
    intervalMinutes: 1440,
    maxItems: 50,
    backfillLimit: 100,
  },
};
const html = await readFile("tests/fixtures/ant-ling-blog.html", "utf8");

describe("Ant Ling official blog", () => {
  it("reads adjacent card metadata, stable slugs and Beijing dates without following WeChat", () => {
    const items = parseAntLingBlog(html, source);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "ling-3.1-flash-open-source",
      author: "蚂蚁百灵",
      language: "zh-CN",
      publishedAt: "2026-10-14T16:00:00.000Z",
      url: "https://developer.ant-ling.com/zh-CN/blogs/ling-3.1-flash-open-source",
    });
    expect(items[1].publishedAt).toBe("2026-09-29T16:00:00.000Z");
    expect(items[0].description).toContain("MXFP4");
  });
  it("decodes XML characters from the title and keeps missing dates absent", () => {
    const changed = html
      .replaceAll(
        "Ling-3.1-flash：面向真实世界任务的模型升级",
        "Ling &amp; Agent &lt;AI&gt;",
      )
      .replace("<span>2026.9.30</span>", "");
    const items = parseAntLingBlog(changed, source);
    expect(items[1].title).toBe("Ling & Agent <AI>");
    expect(items[1].publishedAt).toBeUndefined();
  });
  it.each(["2026.2.31", "2026.13.1", "2099.1.1"])(
    "does not normalize invalid or future date %s into a publication time",
    (date) => {
      expect(
        parseAntLingBlog(html.replace("2026.9.30", date), source)[1]
          .publishedAt,
      ).toBeUndefined();
    },
  );
  it.each([
    "https://outside.example/zh-CN/blogs/ling-3.1-flash",
    "https://developer.ant-ling.com.evil.example/zh-CN/blogs/ling-3.1-flash",
    "http://developer.ant-ling.com/zh-CN/blogs/ling-3.1-flash",
    "/zh-CN/docs/ling-3.1-flash",
    "/zh-CN/blogs/",
    "/zh-CN/blogs/nested/article",
  ])("excludes an unrelated article location %s", (url) => {
    const changed = html.replace(
      'href="/zh-CN/blogs/ling-3.1-flash"',
      `href="${url}"`,
    );
    expect(
      parseAntLingBlog(changed, { ...source, linkHosts: ["outside.example"] }),
    ).toHaveLength(1);
  });
  it.each([
    { url: "http://developer.ant-ling.com/zh-CN/blogs" },
    { url: "https://other.example/zh-CN/blogs" },
    { entryUrl: "https://developer.ant-ling.com/zh-CN/docs" },
    { authorAllowlist: ["third-party"] },
    { platform: "unreviewed-blog" },
  ])(
    "rejects source configuration outside the reviewed directory: %j",
    (patch) => {
      expect(() => parseAntLingBlog(html, { ...source, ...patch })).toThrow(
        "reviewed official directory",
      );
    },
  );
  it("fails on empty shells, redesigned cards and partial malformed batches", () => {
    expect(() =>
      parseAntLingBlog("<main><h1>博客</h1></main>", source),
    ).toThrow("no valid article cards");
    expect(() =>
      parseAntLingBlog(
        html.replaceAll('class="group relative py-8"', 'class="new-card"'),
        source,
      ),
    ).toThrow("no valid article cards");
    expect(() =>
      parseAntLingBlog(
        html.replace("<h2>Ling-3.1-flash：面向真实世界任务的模型升级</h2>", ""),
        source,
      ),
    ).toThrow("metadata changed");
  });
  it("ignores navigation cards even if their links look like articles", () => {
    const card =
      '<nav><div class="group"><a aria-label="Navigation" href="/zh-CN/blogs/navigation"></a><h2>Navigation</h2></div></nav>';
    expect(parseAntLingBlog(card + html, source)).toHaveLength(2);
  });
});
