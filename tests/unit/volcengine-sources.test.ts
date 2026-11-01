import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { Source } from "../../packages/shared/types.js";
import { parseVolcengineAccount } from "../../packages/crawler/platforms/volcengine.js";

const source: Source = {
  id: "bytedance-volcengine",
  publisherId: "bytedance-official",
  name: "字节跳动开源 · 火山引擎",
  entryUrl: "https://developer.volcengine.com/user/1333053764416295",
  url: "https://developer.volcengine.com/user/1333053764416295",
  platform: "volcengine-account",
  adapter: "html",
  priority: "A",
  authorAllowlist: ["1333053764416295"],
  linkPattern: "^/articles/[0-9]+$",
  verification: {
    status: "verified",
    evidenceUrls: ["https://developer.volcengine.com/user/1333053764416295"],
    note: "自有社区的稳定官方账号。",
    reviewedAt: "2026-11-01T00:00:00Z",
  },
  crawl: {
    enabled: true,
    intervalMinutes: 1440,
    maxItems: 50,
    backfillLimit: 100,
  },
};
const fixture = await readFile(
  "tests/fixtures/volcengine-account.html",
  "utf8",
);
const router = () =>
  JSON.parse(/window\._ROUTER_DATA = ([\s\S]*?);<\/script>/.exec(fixture)![1]);
const html = (data: unknown) =>
  `<script>window._ROUTER_DATA = ${JSON.stringify(data)};</script>`;

describe("Volcengine account ownership", () => {
  it("extracts only official metadata using string IDs and publication time", () => {
    const items = parseVolcengineAccount(fixture, source);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "7698691370294181915",
      url: "https://developer.volcengine.com/articles/7698691370294181915",
      publishedAt: "2026-10-20T12:14:30.000Z",
      author: "字节跳动开源",
    });
    expect(JSON.stringify(items)).not.toContain("FULL ARTICLE");
    expect(JSON.stringify(items)).not.toContain("impersonator");
  });

  it("rejects a mismatched source account or account page, even with the same name", () => {
    expect(() =>
      parseVolcengineAccount(fixture, { ...source, authorAllowlist: ["999"] }),
    ).toThrow("reviewed account");
    expect(() =>
      parseVolcengineAccount(fixture, {
        ...source,
        url: "https://developer.volcengine.com/user/999",
      }),
    ).toThrow("reviewed account");
    const data = router();
    data.loaderData["user/(id)/layout"].userInfo.data.user_id = "999";
    expect(() => parseVolcengineAccount(html(data), source)).toThrow(
      "another account",
    );
  });

  it("requires both embedded author IDs to match and ignores recommendation arrays", () => {
    const data = router();
    data.loaderData["user/(id)/page"].articleInfo.data[0].user.user_id = "999";
    data.loaderData["user/(id)/page"].recomArticles = {
      data: data.loaderData["user/(id)/page"].articleInfo.data,
    };
    expect(parseVolcengineAccount(html(data), source)).toHaveLength(1);
  });

  it("fails closed for a login/challenge page, unsuccessful response or malformed batch", () => {
    expect(() =>
      parseVolcengineAccount("<html>captcha</html>", source),
    ).toThrow("structured listing");
    const data = router();
    data.loaderData["user/(id)/page"].articleInfo.err_no = 1;
    expect(() => parseVolcengineAccount(html(data), source)).toThrow(
      "structured listing",
    );
    data.loaderData["user/(id)/page"].articleInfo.err_no = 0;
    data.loaderData["user/(id)/page"].articleInfo.data.push({
      content: { item_id: 7698691370294181915 },
    });
    expect(() => parseVolcengineAccount(html(data), source)).toThrow(
      "malformed",
    );
  });

  it("does not use update_time as publication date or retain oversized abstracts", () => {
    const data = router();
    const item = data.loaderData["user/(id)/page"].articleInfo.data[0];
    item.content.publish_time = 1e100;
    item.content.abstract = "x".repeat(2000);
    const [parsed] = parseVolcengineAccount(html(data), source);
    expect(parsed.publishedAt).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("deduplicates article IDs and handles a verified but empty account", () => {
    const data = router();
    const info = data.loaderData["user/(id)/page"].articleInfo;
    info.data.push(info.data[0]);
    expect(parseVolcengineAccount(html(data), source)).toHaveLength(2);
    info.data = [];
    expect(parseVolcengineAccount(html(data), source)).toEqual([]);
  });
});
