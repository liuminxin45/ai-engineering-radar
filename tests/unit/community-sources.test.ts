import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  collect,
  parseFeed,
  parseListing,
} from "../../packages/crawler/adapters.js";
import { fetchReviewed } from "../../packages/crawler/http.js";
vi.mock("../../packages/crawler/http.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/crawler/http.js")>()),
  fetchReviewed: vi.fn(),
}));
const registry = await loadRegistry();
const source = (id: string) => registry.sources.find((s) => s.id === id)!;
const fixture = (name: string) => readFile(`tests/fixtures/${name}`, "utf8");

describe("domestic community registry", () => {
  it("contains only domestic company and publisher ownership", () => {
    expect(registry.companies.every((c) => c.region === "cn")).toBe(true);
    const companies = new Set(registry.companies.map((c) => c.id));
    expect(registry.publishers.every((p) => companies.has(p.companyId))).toBe(
      true,
    );
    expect(source("tencent-qqnews").publisherId).toBe("tencent-official");
    expect(source("vivo-csdn").publisherId).toBe("vivo-tech");
  });
  it("pins every enabled CSDN feed to a stable account and article path", () => {
    for (const s of registry.sources.filter(
      (s) => s.platform === "csdn-feed" && s.crawl.enabled,
    )) {
      expect(s.authorAllowlist?.length).toBeGreaterThan(0);
      expect(s.linkPattern).toBeTruthy();
      expect(new URL(s.url).hostname).toBe("rss.csdn.net");
      expect(s.verification.status).toBe("verified");
    }
    expect(source("bilibili-csdn").authorAllowlist).toEqual(["bilibili_TC"]);
    expect(source("tencent")).toBeUndefined();
  });
  it("excludes withdrawn Xiaomi sources and ownership", () => {
    expect(registry.companies.some((c) => c.id === "xiaomi")).toBe(false);
    expect(registry.publishers.some((p) => p.companyId === "xiaomi")).toBe(
      false,
    );
    expect(
      registry.sources.some((s) => s.publisherId.startsWith("xiaomi-")),
    ).toBe(false);
  });
});

describe("QQNews official account", () => {
  it("uses stable SUID instead of an impersonated nickname and stores no body", async () => {
    const items = parseListing(
      await fixture("tencent-community.json"),
      source("tencent-qqnews"),
    );
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe("https://news.qq.com/rain/a/20261030A0B2KI00");
    expect(items[0].externalId).toBe("20261030A0B2KI00");
    expect(items[0].publishedAt).toBe("2026-10-30T09:36:48.000Z");
    expect(items[1].publishedAt).toBe("2026-10-28T09:35:54.000Z");
    expect(JSON.stringify(items)).not.toContain("FULL ARTICLE");
  });
  it("fails closed for an endpoint belonging to another account", async () => {
    expect(() =>
      parseListing('{"ret":0,"newslist":[]}', {
        ...source("tencent-qqnews"),
        url: "https://i.news.qq.com/getSubNewsMixedList?guestSuid=other",
      }),
    ).toThrow("reviewed account");
    expect(() =>
      parseListing('{"ret":1,"newslist":[]}', source("tencent-qqnews")),
    ).toThrow("unavailable");
    expect(() =>
      parseListing("<html>captcha</html>", source("tencent-qqnews")),
    ).toThrow("JSON");
  });
  it("does not retain a full-text field as a summary or invent an invalid date", () => {
    const json = JSON.stringify({
      ret: 0,
      newslist: [
        {
          id: "20261030A0B2KI00",
          title: "Public metadata",
          card: { suid: "8QMZ23lf74UYuTs=" },
          timestamp: 1e100,
          abstract: "x".repeat(2000),
          html_content: "FULL ARTICLE",
        },
      ],
    });
    const [item] = parseListing(json, source("tencent-qqnews"));
    expect(item.description).toBeUndefined();
    expect(item.publishedAt).toBeUndefined();
  });
});

describe("community feed and HTML ownership", () => {
  it("makes one CSDN feed request without supplemental article HTML", async () => {
    const xml = (await fixture("csdn-community.xml")).replace(
      "<description>SmartFlow 的规格化与验证流程。</description>",
      "",
    );
    const mocked = vi.mocked(fetchReviewed);
    mocked.mockReset();
    mocked.mockResolvedValue({
      status: 200,
      text: xml,
      url: source("vivo-csdn").url,
    });
    const result = await collect(
      source("vivo-csdn"),
      {
        sourceId: "vivo-csdn",
        status: "new",
        consecutiveFailures: 0,
        discovered: 0,
      },
      20,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBeUndefined();
    expect(mocked).toHaveBeenCalledTimes(1);
  });
  it("ignores full-body feed summaries even when the article body is short", () => {
    const xml =
      '<feed xmlns="http://www.w3.org/2005/Atom"><author><name>Team</name></author><entry><title>Metadata only</title><link href="https://team.example/2020/05/24/post/"/><summary>FULL ARTICLE MUST NOT BE STORED</summary><content>FULL ARTICLE MUST NOT BE STORED</content><published>2020-05-24T09:15:00Z</published></entry></feed>';
    const [item] = parseFeed(xml, {
      ...source("vivo-csdn"),
      platform: "team-blog-feed",
      entryUrl: "https://team.example/",
      url: "https://team.example/atom.xml",
      authorAllowlist: ["Team"],
      linkPattern: undefined,
    });
    expect(item.author).toBe("Team");
    expect(item.description).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain("FULL ARTICLE");
  });
  it("filters CSDN by username, reviewed host and exact account path", async () => {
    const items = parseFeed(
      await fixture("csdn-community.xml"),
      source("vivo-csdn"),
    );
    expect(items).toHaveLength(1);
    expect(items[0].publishedAt).toBe("2026-10-29T02:39:59.000Z");
  });
  it("associates each cnblogs title with its own excerpt and time", async () => {
    const items = parseListing(
      await fixture("cnblogs-community.html"),
      source("jd-cnblogs"),
    );
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("OxygenData-Vibe 搭建实践");
    expect(items[0].publishedAt).toBe("2026-10-28T06:08:00.000Z");
    expect(items[1].publishedAt).toBe("2026-10-20T01:48:00.000Z");
    expect(items[1].description).toBe("运筹模型和学习组件的评价。");
    expect(JSON.stringify(items)).not.toContain("FULL ARTICLE");
  });
  it("rejects a cnblogs source whose configured account differs", () => {
    expect(() =>
      parseListing("", { ...source("jd-cnblogs"), authorAllowlist: ["other"] }),
    ).toThrow("reviewed account");
  });
});
