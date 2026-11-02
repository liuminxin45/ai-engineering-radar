import { aliyunFixture } from "../fixtures/aliyun-source.js";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  parseAliyunGroup,
  nextAliyunPage,
} from "../../packages/crawler/platforms/aliyun.js";
import type { Source } from "../../packages/shared/types.js";

const registry = await loadRegistry();
const base = aliyunFixture;
const source = (
  group = "apphub/article/",
  account = "pawmkwdq37c7s",
): Source => ({
  ...base,
  url: `https://developer.aliyun.com/group/${group}`,
  entryUrl: `https://developer.aliyun.com/group/${group}`,
  authorAllowlist: [account],
  linkPattern: "^/article/[0-9]+/?$",
});
const fixture = (name: string) =>
  readFile(`tests/fixtures/aliyun-${name}.html`, "utf8");

describe("Aliyun official group listings", () => {
  it("registers the requested directory as Alibaba's only blog source and keeps the restricted profile retired", () => {
    const publisherIds = new Set(
      registry.publishers
        .filter((p) => p.companyId === "alibaba")
        .map((p) => p.id),
    );
    const sources = registry.sources.filter(
      (s) => publisherIds.has(s.publisherId) && s.contentType !== "paper",
    );
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      id: "aliyun-apphub",
      entryUrl: "https://developer.aliyun.com/group/apphub/article/",
      url: "https://developer.aliyun.com/group/apphub/article/",
      platform: "aliyun-group",
      authorAllowlist: ["pawmkwdq37c7s"],
    });
    expect(registry.sources.some((s) => s.id === "aliyun-cloud-native")).toBe(
      false,
    );
  });
  it("binds each article to its stable profile instead of an impersonated display name", async () => {
    const items = parseAliyunGroup(await fixture("apphub"), source());
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "阿里云刚发布的 AgentCore 有何不同？",
      url: "https://developer.aliyun.com/article/1776525",
      externalId: "1776525",
      author: "阿里云云原生",
      publishedAt: "2026-10-28T16:00:00.000Z",
      language: "zh-CN",
    });
    expect(items[1].publishedAt).toBe("2026-10-29T04:34:56.000Z");
    expect(items.every((item) => item.description === undefined)).toBe(true);
  });

  it("isolates Dataphin ownership and excludes article links outside the group rows", async () => {
    const html = await fixture("dataphin");
    const [item] = parseAliyunGroup(html, source("dataphin/", "ylyeppx3vlhce"));
    expect(item.externalId).toBe("1777073");
    expect(item.author).toBe("瓴羊Dataphin");
    expect(item.publishedAt).toBe("2026-10-29T16:00:00.000Z");
    expect(parseAliyunGroup(html, source())).toEqual([]);
  });

  it("rejects foreign hosts for author identity and article addresses", async () => {
    const html = await fixture("apphub");
    expect(
      parseAliyunGroup(
        html.replaceAll(
          "/profile/pawmkwdq37c7s",
          "https://attacker.example/profile/pawmkwdq37c7s",
        ),
        source(),
      ),
    ).toEqual([]);
    const foreignArticles = html
      .replaceAll(
        "/article/1776525",
        "https://attacker.example/article/1776525",
      )
      .replaceAll(
        "https://developer.aliyun.com/article/1776498",
        "https://attacker.example/article/1776498",
      );
    expect(parseAliyunGroup(foreignArticles, source())).toEqual([]);
  });

  it("fails closed for a missing profile allowlist or mismatched reviewed group", async () => {
    const html = await fixture("apphub");
    expect(() =>
      parseAliyunGroup(html, { ...source(), authorAllowlist: [] }),
    ).toThrow("reviewed profile IDs");
    expect(() =>
      parseAliyunGroup(html, {
        ...source(),
        url: "https://developer.aliyun.com/group/other/",
      }),
    ).toThrow("reviewed entry");
    expect(() =>
      parseAliyunGroup(html, {
        ...source(),
        url: "https://attacker.example/group/apphub/article/",
      }),
    ).toThrow("reviewed official group");
  });

  it("does not invent invalid or future publication dates", async () => {
    const html = await fixture("dataphin");
    for (const value of [
      "2026-02-30",
      "2099-01-01",
      "2026-10-30 25:00:00",
      "recently",
    ]) {
      const [item] = parseAliyunGroup(
        html.replace("2026-10-30", value),
        source("dataphin/", "ylyeppx3vlhce"),
      );
      expect(item.publishedAt).toBeUndefined();
    }
  });

  it("deduplicates cover and repeated links without storing synthetic article-body fields", async () => {
    let html = await fixture("dataphin");
    const row = html.match(/<li class="all-list-box">[\s\S]*?<\/li>/)![0];
    html = html
      .replace("</ul>", row + "</ul>")
      .replace(
        "</body>",
        '<div class="full-content">FULL ARTICLE MUST NOT BE STORED</div></body>',
      );
    const items = parseAliyunGroup(html, source("dataphin/", "ylyeppx3vlhce"));
    expect(items).toHaveLength(1);
    expect(JSON.stringify(items)).not.toContain("FULL ARTICLE");
  });

  it("does not accept a row with multiple conflicting author identities", async () => {
    const html = (await fixture("dataphin")).replace(
      /(<span class="time">)/,
      '<a class="user" href="/profile/another">Another author</a>$1',
    );
    expect(
      parseAliyunGroup(html, source("dataphin/", "ylyeppx3vlhce")),
    ).toEqual([]);
  });
});

describe("Aliyun public pagination", () => {
  it("follows the next numbered page of the same group", async () => {
    expect(nextAliyunPage(await fixture("apphub"), source())).toBe(
      "https://developer.aliyun.com/group/apphub/article/?pageNum=2",
    );
    expect(
      nextAliyunPage(
        await fixture("dataphin"),
        source("dataphin/", "ylyeppx3vlhce"),
      ),
    ).toBe("https://developer.aliyun.com/group/dataphin/?pageNum=2");
    expect(
      nextAliyunPage('<a href="?pageNum=3">next</a>', {
        ...source(),
        url: source().url + "?pageNum=2",
      }),
    ).toBe("https://developer.aliyun.com/group/apphub/article/?pageNum=3");
  });

  it("does not jump groups, hosts, credentials or arbitrary page numbers", () => {
    const html =
      '<a href="https://attacker.example/group/apphub/article/?pageNum=2">2</a><a href="/group/other/?pageNum=2">2</a><a href="https://attacker@developer.aliyun.com/group/apphub/article/?pageNum=2">2</a><a href="?pageNum=25">25</a>';
    expect(nextAliyunPage(html, source())).toBeUndefined();
    expect(
      nextAliyunPage('<a href="?pageNum=2">2</a>', {
        ...source(),
        url: source().url + "?pageNum=invalid",
      }),
    ).toBeUndefined();
  });
});
