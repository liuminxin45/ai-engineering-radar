import { expect, it } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { parseFeed } from "../../packages/crawler/adapters.js";

it("collects only the reviewed AntData author and account article paths", async () => {
  const source = (await loadRegistry()).sources.find(
    (s) => s.id === "ant-data-csdn",
  )!;
  expect(source.entryUrl).toBe("https://devpress.csdn.net/user/DB_GPT");
  const item = (author: string, account: string, id: string) =>
    `<item><title>蚂蚁数据工程实践</title><link>https://blog.csdn.net/${account}/article/details/${id}</link><author>${author}</author><guid>${id}</guid><pubDate>Fri, 12 Jun 2026 07:03:51 GMT</pubDate></item>`;
  const rss = `<rss version="2.0"><channel>${item("DB_GPT", "DB_GPT", "1")}${item("db_gpt", "DB_GPT", "2")}${item("DB_GPT", "other", "3")}</channel></rss>`;
  expect(parseFeed(rss, source)).toMatchObject([
    {
      author: "DB_GPT",
      externalId: "1",
      publishedAt: "2026-06-12T07:03:51.000Z",
    },
  ]);
});
it("accepts the actual case-sensitive OceanBase RSS identity and excludes unrelated authors", async () => {
  const base = (await loadRegistry()).sources.find(
    (s) => s.id === "vivo-csdn",
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
