import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  loadRegistry,
  validateAccountScope,
} from "../../packages/source-registry/index.js";
import { parseFeed, parseListing } from "../../packages/crawler/adapters.js";

it("routes the reviewed Ant Ling directory through its adapter and rejects a different account", async () => {
  const r = await loadRegistry();
  const s = r.sources.find((s) => s.id === "ant-ling")!;
  const html = await readFile("tests/fixtures/ant-ling-blog.html", "utf8");
  expect(parseListing(html, s)[0].publishedAt).toBe("2026-10-14T16:00:00.000Z");
  expect(() =>
    validateAccountScope({ ...s, authorAllowlist: ["some-other-team"] }),
  ).toThrow("official blog directory");
  expect(() =>
    validateAccountScope({
      ...s,
      url: "https://developer.ant-ling.com/zh-CN/docs",
    }),
  ).toThrow("official blog directory");
});
it("accepts the actual case-sensitive OceanBase RSS identity and excludes unrelated authors", async () => {
  const s = (await loadRegistry()).sources.find(
    (s) => s.id === "ant-oceanbase-csdn",
  )!;
  const item = (author: string, id: string) =>
    `<item><title>并发查询预测 &amp; 工程实践</title><link>https://blog.csdn.net/OceanBaseGFBK/article/details/${id}</link><author>${author}</author><guid>${id}</guid><pubDate>Thu, 29 Oct 2026 02:39:19 GMT</pubDate></item>`;
  const rss = `<rss version="2.0"><channel>${item("OceanBaseGFBK", "169443532")}${item("unrelated-author", "2")}</channel></rss>`;
  expect(parseFeed(rss, s)).toHaveLength(1);
  expect(parseFeed(rss, s)[0]).toMatchObject({
    author: "OceanBaseGFBK",
    externalId: "169443532",
    publishedAt: "2026-10-29T02:39:19.000Z",
    title: "并发查询预测 & 工程实践",
  });
});
it("keeps the unconfirmed Baidu account and inaccessible Kuaishou account out of collection", async () => {
  const r = await loadRegistry();
  const baidu = r.sources.find((s) => s.id === "baidu-cloud-csdn-candidate")!;
  expect(baidu.verification.status).toBe("pending");
  expect(baidu.crawl.enabled).toBe(false);
  const kuaishou = r.sources.find((s) => s.id === "kuaishou-infoq")!;
  expect(kuaishou.crawl.enabled).toBe(false);
  expect(kuaishou.adapter).toBe("reference");
});
