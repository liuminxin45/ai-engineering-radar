import { aliyunFixture } from "../fixtures/aliyun-source.js";
import { beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
vi.mock("../../packages/crawler/http.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../packages/crawler/http.js")>();
  return { ...original, fetchReviewed: vi.fn() };
});
import { collect } from "../../packages/crawler/adapters.js";
import { fetchReviewed } from "../../packages/crawler/http.js";
import { loadRegistry } from "../../packages/source-registry/index.js";
const registry = await loadRegistry();
const source = {
  ...aliyunFixture,
  adapter: "html" as const,
  platform: "aliyun-group",
  entryUrl: "https://developer.aliyun.com/group/apphub/article/",
  url: "https://developer.aliyun.com/group/apphub/article/",
  authorAllowlist: ["pawmkwdq37c7s"],
  linkPattern: "^/article/[0-9]+/?$",
};
const state = {
  sourceId: source.id,
  status: "new" as const,
  discovered: 0,
  consecutiveFailures: 0,
  etag: "first-page-etag",
};
const first = await readFile("tests/fixtures/aliyun-apphub.html", "utf8");
const second = first
  .replaceAll("1776525", "1776001")
  .replaceAll("1776498", "1776002");
beforeEach(() => vi.mocked(fetchReviewed).mockReset());
it("uses bounded public pagination, preserves first-page validators and avoids article-body requests", async () => {
  vi.mocked(fetchReviewed)
    .mockResolvedValueOnce({
      status: 200,
      text: first,
      url: source.url,
      etag: "fresh-etag",
    })
    .mockResolvedValueOnce({
      status: 200,
      text: second,
      url: source.url + "?pageNum=2",
      etag: "page-two-etag",
    });
  const result = await collect(source, state, 3);
  expect(result.items).toHaveLength(3);
  expect(new Set(result.items.map((i) => i.externalId)).size).toBe(3);
  expect(result.response.etag).toBe("fresh-etag");
  expect(fetchReviewed).toHaveBeenCalledTimes(2);
  expect(vi.mocked(fetchReviewed).mock.calls[1][0]).toBe(
    source.url + "?pageNum=2",
  );
  expect(vi.mocked(fetchReviewed).mock.calls[1][2]).toBeUndefined();
});
it("does not request pagination or detail pages after a conditional 304", async () => {
  vi.mocked(fetchReviewed).mockResolvedValue({
    status: 304,
    text: "",
    url: source.url,
  });
  const result = await collect(source, state, 100);
  expect(result.items).toEqual([]);
  expect(fetchReviewed).toHaveBeenCalledExactlyOnceWith(source.url, source, {
    "If-None-Match": "first-page-etag",
  });
});
it("fails the whole source batch when a required later page cannot be read", async () => {
  vi.mocked(fetchReviewed)
    .mockResolvedValueOnce({ status: 200, text: first, url: source.url })
    .mockRejectedValueOnce(new Error("second page failed"));
  await expect(collect(source, state, 100)).rejects.toThrow(
    "second page failed",
  );
});
