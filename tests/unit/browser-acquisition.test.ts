import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { createCsdnBodyLoader } from "../../packages/crawler/platforms/csdn-body.js";
import { createBrowserDocumentClient } from "../../packages/crawler/acquisition/browser.js";
import { acquireWithFallback } from "../../packages/crawler/acquisition/chain.js";
import { collectBodies } from "../../packages/crawler/bodies.js";
import { upsert } from "../../packages/crawler/deduplicate.js";
import { articleParser } from "../../packages/article-parser/index.js";
import type { Article } from "../../packages/shared/types.js";
const registry = await loadRegistry();
const source = registry.sources.find((s) => s.id === "vivo-csdn")!;
const url = "https://blog.csdn.net/vivo_tech/article/details/123456";
const article = { title: "工程实践" } as Article;
const html =
  '<h1 id="articleContentId">工程实践</h1><div id="content_views"><pre><code>{</code><code>  "repo": true</code><code>}</code><div class="opt-box">AI写代码</div></pre><ul class="pre-numbering"><li>1</li></ul><div class="hide-preCode-box"><img src="https://example.org/button.png"></div><table><tr><td>正文</td></tr></table></div>';
afterEach(() => vi.unstubAllEnvs());
describe("document providers and CSDN orchestration", () => {
  it("refreshes the legacy CSDN rule once and then skips successful unchanged bodies", async () => {
    const articles: Article[] = [];
    upsert(articles, { title: article.title, url }, source, registry);
    const parsed = articleParser.parse({ url, content: html });
    const loader = vi.fn(async () => parsed);
    const initial = await collectBodies(articles, [], registry, {
      incremental: true,
      loader,
    });
    const previous = [
      { ...initial.bodies[0], ruleId: "rsshub-csdn", ruleVersion: "1" },
    ];
    const refreshed = await collectBodies(articles, previous, registry, {
      incremental: true,
      loader,
    });
    expect(refreshed.attempted).toBe(1);
    expect(refreshed.bodies[0].ruleVersion).toBe("2");
    const unchanged = await collectBodies(
      articles,
      refreshed.bodies,
      registry,
      { incremental: true, loader },
    );
    expect(unchanged.attempted).toBe(0);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("skips the browser on a successful primary, then uses it when the primary fails", async () => {
    const primary = { body: vi.fn().mockResolvedValue("<p>原站短文。</p>") };
    const browser = vi.fn().mockResolvedValue({ url, content: html });
    const load = createCsdnBodyLoader({ rssHub: primary, browser });
    expect((await load(article, source, url)).acquisition.provider).toBe(
      "rsshub-http",
    );
    expect(browser).not.toHaveBeenCalled();
    primary.body.mockRejectedValue(new Error("HTTP 521"));
    const result = await load(article, source, url);
    expect(result.acquisition).toEqual({
      provider: "camoufox",
      attempts: [
        { provider: "rsshub-http", status: "failed" },
        { provider: "camoufox", status: "success" },
      ],
    });
    expect(result.ruleId).toBe("csdn");
    expect(result.ruleVersion).toBe("2");
    expect(result.html).toContain('"repo"');
    expect(result.html).toContain("\n  ");
    expect(result.html).not.toMatch(/AI写代码|pre-numbering|button.png/);
  });
  it("also falls back when HTTP succeeds with an access page, and rejects wrong titles", async () => {
    const browser = vi.fn().mockResolvedValue({ url, content: html });
    const http = vi
      .fn()
      .mockResolvedValue({ text: "<title>访问验证</title>not an article" });
    vi.stubEnv("RSSHUB_URL", "");
    const load = createCsdnBodyLoader({ http, browser });
    expect((await load(article, source, url)).acquisition.provider).toBe(
      "camoufox",
    );
    browser.mockResolvedValue({
      url,
      content: html.replace("工程实践", "另一篇文章"),
    });
    await expect(load(article, source, url)).rejects.toThrow("正文获取失败");
  });
  it("validates targets before doing any transport work", async () => {
    const browser = vi.fn();
    const primary = { body: vi.fn() };
    const load = createCsdnBodyLoader({ rssHub: primary, browser });
    await expect(
      load(
        article,
        source,
        "https://blog.csdn.net/unreviewed/article/details/123456",
      ),
    ).rejects.toThrow("reviewed");
    expect(primary.body).not.toHaveBeenCalled();
    expect(browser).not.toHaveBeenCalled();
  });
  it("keeps transport implementations independent of the document consumer", async () => {
    const bad = vi.fn().mockResolvedValue({ url, content: "challenge" });
    const next = vi.fn().mockResolvedValue({ url, content: "good" });
    const result = await acquireWithFallback(
      [
        { id: "http", fetch: bad },
        { id: "replacement", fetch: next },
      ],
      (doc) => {
        if (doc.content !== "good") throw Error("not article");
        return { value: doc.content };
      },
    );
    expect(result.value).toBe("good");
    expect(result.acquisition.provider).toBe("replacement");
  });
  it("validates browser responses, returned identities and endpoint configuration", async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          document: { url, content: html, format: "html" },
        }),
      ),
    );
    const read = createBrowserDocumentClient(
      "http://127.0.0.1:1201",
      transport,
    )!;
    expect((await read(source, url)).content).toBe(html);
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ url });
    expect(() =>
      createBrowserDocumentClient("http://192.168.1.2:1201"),
    ).toThrow();
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          document: {
            url: url.replace("123456", "999"),
            content: html,
            format: "html",
          },
        }),
      ),
    );
    await expect(read(source, url)).rejects.toThrow("different article");
    transport.mockResolvedValue(new Response("error", { status: 502 }));
    await expect(read(source, url)).rejects.toThrow("Browser fetch HTTP 502");
  });
});
