import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import {
  createRssHubClient,
  csdnAccount,
  parseRssHubFeed,
  rssHubBody,
  rssHubCandidates,
} from "../../packages/crawler/rsshub.js";
import { createBodyLoader } from "../../packages/crawler/body-fetchers.js";
import { collect } from "../../packages/crawler/adapters.js";
import type { Article } from "../../packages/shared/types.js";

const registry = await loadRegistry();
const source = registry.sources.find((source) => source.id === "vivo-csdn")!;
const url = "https://blog.csdn.net/vivo_tech/article/details/123456";
const item = {
  title: "工程实践",
  link: url,
  creator: "vivo_tech",
  author: "vivo_tech",
  content: "发布方提供的短摘要",
  guid: url,
  isoDate: "2026-10-01T00:00:00.000Z",
};
const feed = (items: unknown[] = [item]) => ({
  title: "vivo互联网技术 - CSDN博客",
  item: items,
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("RSSHub CSDN boundary", () => {
  it("derives routes from the reviewed account rather than a caller supplied URL", () => {
    expect(csdnAccount(source)).toBe("vivo_tech");
    expect(() =>
      csdnAccount({ ...source, authorAllowlist: ["someone_else"] }),
    ).toThrow(/reviewed/);
    expect(() =>
      csdnAccount({
        ...source,
        url: "https://rss.csdn.net/vivo_tech/rss/map?user=other",
      }),
    ).toThrow();
    expect(() =>
      csdnAccount({
        ...source,
        url: "https://user@rss.csdn.net/vivo_tech/rss/map",
      }),
    ).toThrow();
  });
  it("rejects cross-account authors, paths and non-publisher URLs", () => {
    const items = parseRssHubFeed(
      feed([
        item,
        { ...item, creator: "other" },
        { ...item, author: "other" },
        { ...item, link: "https://blog.csdn.net/other/article/details/123456" },
        {
          ...item,
          link: "https://example.org/vivo_tech/article/details/123456",
        },
      ]),
      source,
    );
    expect(items).toHaveLength(1);
    expect(rssHubCandidates(items)[0]).toMatchObject({
      title: "工程实践",
      url,
      author: "vivo_tech",
      externalId: url,
      description: item.content,
    });
  });
  it("never converts successful RSS summary fallback into an article body", () => {
    expect(() => rssHubBody(parseRssHubFeed(feed(), source), url)).toThrow(
      /仅返回摘要/,
    );
    expect(() =>
      rssHubBody(
        parseRssHubFeed(
          feed([{ ...item, description: `<p>${item.content}</p>` }]),
          source,
        ),
        url,
      ),
    ).toThrow(/仅返回摘要/);
    expect(() =>
      rssHubBody(parseRssHubFeed(feed(), source), `${url}0`),
    ).toThrow(/历史文章/);
    expect(() =>
      parseRssHubFeed({ error: { message: "blocked" } }, source),
    ).toThrow(/invalid feed/);
  });
  it("uses a separate full body field and keeps it out of metadata", () => {
    const html = "<h2>实践</h2><p>这是正文与发布方短摘要不同的内容。</p>";
    const items = parseRssHubFeed(
      feed([{ ...item, description: html }]),
      source,
    );
    expect(rssHubBody(items, url)).toBe(html);
    expect(rssHubCandidates(items)[0].description).toBe(item.content);
  });
  it("shares an account response within a body run and validates HTTP failures", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(feed())));
    const load = createRssHubClient("http://127.0.0.1:1200", transport)!;
    await Promise.all([load(source), load(source)]);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toBe(
      "http://127.0.0.1:1200/csdn/index/vivo_tech",
    );
    expect(() => createRssHubClient("http://192.168.1.2:1200")).toThrow();
    const fail = createRssHubClient(
      "http://127.0.0.1:1200",
      vi.fn().mockResolvedValue(new Response("error", { status: 502 })),
    )!;
    await expect(fail(source)).rejects.toThrow("RSSHub HTTP 502");
    const invalid = createRssHubClient(
      "http://127.0.0.1:1200",
      vi.fn().mockResolvedValue(new Response("<html>error</html>")),
    )!;
    await expect(invalid(source)).rejects.toThrow(/invalid JSON/);
  });
  it("routes discovery and cleaned bodies through RSSHub without direct CSDN requests", async () => {
    vi.stubEnv("RSSHUB_URL", "http://127.0.0.1:1200");
    const html = `<h2>工程实践</h2><p>${"真实正文。".repeat(60)}</p><script>alert(1)</script>`;
    const transport = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify(feed([{ ...item, description: html }]))),
      );
    vi.stubGlobal("fetch", transport);
    const result = await collect(
      source,
      {
        sourceId: source.id,
        status: "new",
        consecutiveFailures: 0,
        discovered: 0,
      },
      20,
    );
    expect(result.items).toHaveLength(1);
    const loader = createBodyLoader();
    const parsed = await loader({ title: item.title } as Article, source, url);
    expect(parsed.ruleId).toBe("csdn");
    expect(parsed.acquisition?.provider).toBe("rsshub-http");
    expect(parsed.status).toBe("ready");
    expect(parsed.html).not.toContain("<script>");
    expect(
      transport.mock.calls.map(([target]) => new URL(String(target)).pathname),
    ).toEqual(["/csdn/index/vivo_tech", "/csdn/body/vivo_tech/123456"]);
    expect(
      transport.mock.calls.every(
        ([target]) => new URL(String(target)).hostname === "127.0.0.1",
      ),
    ).toBe(true);
  });
  it("uses directory validators without suppressing a specific historic body retry", async () => {
    const transport = vi.fn().mockImplementation(async (target) => {
      if (String(target).includes("/index/"))
        return new Response(null, { status: 304, headers: { etag: '"old"' } });
      return new Response(
        JSON.stringify(
          feed([{ ...item, description: "<p>重新抓到的正文</p>" }]),
        ),
      );
    });
    const client = createRssHubClient("http://127.0.0.1:1200", transport)!;
    expect(await client.discover(source, '"old"')).toMatchObject({
      status: 304,
      items: [],
      etag: '"old"',
    });
    expect(transport.mock.calls[0][1].headers["If-None-Match"]).toBe('"old"');
    expect(await client.body(source, url)).toContain("重新抓到的正文");
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
