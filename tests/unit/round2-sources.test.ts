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
  const base = (await loadRegistry()).sources.find(
    (s) => s.id === "huawei-csdn",
  )!;
  // Keep adapter coverage for retired accounts without registering a second source.
  const s = {
    ...base,
    entryUrl: "https://blog.csdn.net/OceanBaseGFBK",
    url: "https://rss.csdn.net/OceanBaseGFBK/rss/map",
    authorAllowlist: ["OceanBaseGFBK"],
    linkPattern: "^/OceanBaseGFBK/article/details/[0-9]+/?$",
  };
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
it("collects the reviewed Baidu account while rejecting unrelated authors and account paths", async () => {
  const baidu = (await loadRegistry()).sources.find(
    (s) => s.id === "baidu-cloud-csdn-candidate",
  )!;
  expect(baidu.verification.status).toBe("verified");
  expect(baidu.crawl.enabled).toBe(true);
  const item = (author: string, account: string, id: string) =>
    `<item><title>KVCache 工程实践</title><link>https://blog.csdn.net/${account}/article/details/${id}</link><author>${author}</author><guid>${id}</guid></item>`;
  const rss = `<rss version="2.0"><channel>${item("2301_82040283", "2301_82040283", "168653897")}${item("other-author", "2301_82040283", "2")}${item("2301_82040283", "other-account", "3")}</channel></rss>`;
  expect(parseFeed(rss, baidu).map((a) => a.externalId)).toEqual(["168653897"]);
});
it("keeps the inaccessible Kuaishou account out of collection", async () => {
  const kuaishou = (await loadRegistry()).sources.find(
    (s) => s.id === "kuaishou-infoq",
  )!;
  expect(kuaishou).toBeUndefined();
});
