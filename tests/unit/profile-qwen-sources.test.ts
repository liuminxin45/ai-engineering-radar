import { aliyunFixture } from "../fixtures/aliyun-source.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  loadRegistry,
  validateAccountScope,
} from "../../packages/source-registry/index.js";
import {
  parseAliyunProfile,
  nextAliyunProfilePage,
} from "../../packages/crawler/platforms/aliyun.js";
import {
  parseQwenResearch,
  QWEN_CURRENT,
  QWEN_LEGACY,
} from "../../packages/crawler/platforms/qwen.js";
import { collect } from "../../packages/crawler/adapters.js";
import { fetchReviewed } from "../../packages/crawler/http.js";
vi.mock("../../packages/crawler/http.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/crawler/http.js")>()),
  fetchReviewed: vi.fn(),
}));
const registry = await loadRegistry();
const aliyun = aliyunFixture;
const legacyRegistry = JSON.parse(
  await readFile("tests/fixtures/legacy-paper-registry.json", "utf8"),
);
const qwen = legacyRegistry.sources.find(
  (s: { id: string }) => s.id === "qwen-research",
);
const profile = await readFile("tests/fixtures/aliyun-profile.html", "utf8");
const legacy = [
  {
    id: "qwen3",
    title: "Archived Qwen",
    author: "QwenTeam",
    date: "2025-04-29T10:00:00+08:00",
  },
];
const current = (
  articles: any[] = [
    {
      path: "qwen-image-2.1",
      title: "Qwen Image",
      type: "qwen_ai",
      language: "en-US",
      content: "FULL BODY",
      extra: {
        author: "QwenTeam",
        date: "2026-09-20T20:00:00+08:00",
        introduction: "FULL BODY EXCERPT",
        git_url: "https://private.example/repository",
      },
    },
  ],
) => JSON.stringify({ success: true, data: { articles } });
beforeEach(() => vi.mocked(fetchReviewed).mockReset());

describe("requested Aliyun profile", () => {
  it("checks the profile identity and only indexes published article activity", () => {
    const items = parseAliyunProfile(profile, aliyun);
    expect(items.map((v) => v.externalId)).toEqual(["1776525", "1776001"]);
    expect(items[0].publishedAt).toBe("2026-10-29T03:37:14.000Z");
    expect(
      parseAliyunProfile(
        profile.replace(
          'href="/article/1776525"',
          'href="https://other.example/article/1776525"',
        ),
        aliyun,
      ),
    ).toHaveLength(1);
    expect(() =>
      parseAliyunProfile(
        profile.replace("'pawmkwdq37c7s'", "'anotherprofile'"),
        aliyun,
      ),
    ).toThrow("identity");
    expect(() =>
      parseAliyunProfile(
        '<script>localStorage.x5referer = "https://login.m.taobao.com"</script>',
        aliyun,
      ),
    ).toThrow("requires login");
  });
  it("follows only the next numbered page of the same profile", () => {
    expect(nextAliyunProfilePage(profile, aliyun)).toBe(
      "https://developer.aliyun.com/profile/expert/pawmkwdq37c7s/news_2",
    );
    expect(
      nextAliyunProfilePage(
        profile.replaceAll("pawmkwdq37c7s/news_2", "anotherprofile/news_2"),
        aliyun,
      ),
    ).toBeUndefined();
    expect(() =>
      validateAccountScope({ ...aliyun, authorAllowlist: ["anotherprofile"] }),
    ).toThrow();
  });
  it("paginates without fetching article bodies", async () => {
    vi.mocked(fetchReviewed)
      .mockResolvedValueOnce({ status: 200, text: profile, url: aliyun.url })
      .mockResolvedValueOnce({
        status: 200,
        text: profile
          .replaceAll("1776525", "1775001")
          .replaceAll("1776001", "1775002"),
        url: "https://developer.aliyun.com/profile/expert/pawmkwdq37c7s/news_2",
      });
    expect(
      (
        await collect(
          aliyun,
          {
            sourceId: aliyun.id,
            status: "new",
            discovered: 0,
            consecutiveFailures: 0,
          },
          3,
        )
      ).items,
    ).toHaveLength(3);
    expect(fetchReviewed).toHaveBeenCalledTimes(2);
  });
});

describe("Qwen Research", () => {
  it("keeps the retired company and source out of the registry", () => {
    expect(registry.companies.some((c) => c.id === "qwen")).toBe(false);
    expect(registry.sources.some((s) => s.id === "qwen-research")).toBe(false);
    expect(qwen.entryUrl).toBe("https://qwen.ai/research");
    expect(() =>
      validateAccountScope({ ...qwen, url: "https://other.example/research" }),
    ).toThrow();
    expect(aliyun.entryUrl).toBe(
      "https://developer.aliyun.com/profile/pawmkwdq37c7s",
    );
  });
  it("merges public research feeds, preserves original dates, and discards body and internal fields", () => {
    const items = parseQwenResearch(
      current(),
      JSON.stringify([...legacy, { ...legacy[0], id: "unlisted-news" }]),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://qwen.ai/blog?id=qwen-image-2.1",
      externalId: "qwen-image-2.1",
      publishedAt: "2026-09-20T12:00:00.000Z",
    });
    expect(JSON.stringify(items)).not.toMatch(
      /FULL BODY|private\.example|git_url|introduction/,
    );
  });
  it("rejects malformed feeds, draft items, wrong types, languages, authors and unsafe paths", () => {
    const base = {
      path: "qwen-next",
      title: "Qwen Next",
      type: "qwen_ai",
      language: "en-US",
      extra: { author: "QwenTeam", date: "2026-02-30T10:00:00+08:00" },
    };
    for (const patch of [
      { path: "../outside" },
      { type: "other" },
      { language: "zh-CN" },
      { extra: { author: "Impersonator" } },
      { extra: { author: "QwenTeam", draft: true } },
    ])
      expect(parseQwenResearch(current([{ ...base, ...patch }]), "[]")).toEqual(
        [],
      );
    expect(
      parseQwenResearch(current([base]), "[]")[0].publishedAt,
    ).toBeUndefined();
    expect(() => parseQwenResearch('{"success":false}', "[]")).toThrow(
      "unavailable",
    );
  });
  it("deduplicates by public slug and keeps v2 metadata", () => {
    const items = parseQwenResearch(
      current([
        {
          path: "qwen3",
          title: "Updated Qwen",
          type: "qwen_ai",
          language: "en-US",
          extra: { author: "QwenTeam", date: "2025-05-01T00:00:00Z" },
        },
      ]),
      JSON.stringify(legacy),
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Updated Qwen");
  });
  it("refreshes both JSON feeds even when the HTML shell has cached validators", async () => {
    vi.mocked(fetchReviewed)
      .mockResolvedValueOnce({
        status: 200,
        text: "<html>App shell</html>",
        url: qwen.url,
        etag: "shell",
      })
      .mockResolvedValueOnce({
        status: 200,
        text: current(),
        url: QWEN_CURRENT,
      })
      .mockResolvedValueOnce({
        status: 200,
        text: JSON.stringify(legacy),
        url: QWEN_LEGACY,
      });
    const result = await collect(
      qwen,
      {
        sourceId: qwen.id,
        status: "success",
        discovered: 2,
        consecutiveFailures: 0,
        etag: "cached-shell",
      },
      100,
    );
    expect(result.items).toHaveLength(2);
    expect(fetchReviewed).toHaveBeenNthCalledWith(1, qwen.url, qwen, {});
    expect(fetchReviewed).toHaveBeenCalledTimes(3);
    expect(result.response.etag).toBeUndefined();
  });
});
