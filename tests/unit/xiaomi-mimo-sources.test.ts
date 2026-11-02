import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
vi.mock("../../packages/crawler/http.js", async (original) => ({
  ...(await original<typeof import("../../packages/crawler/http.js")>()),
  fetchReviewed: vi.fn(),
}));
import { fetchReviewed } from "../../packages/crawler/http.js";
import { collect } from "../../packages/crawler/adapters.js";
import { validateAccountScope } from "../../packages/source-registry/index.js";
import {
  miMoScripts,
  miMoHomeScript,
  parseMiMoListing,
  parseMiMoMetadata,
  miMoArticleFrame,
} from "../../packages/crawler/platforms/xiaomi-mimo.js";

const source = JSON.parse(
  await readFile("tests/fixtures/xiaomi-mimo-source.json", "utf8"),
);
const html = await readFile("tests/fixtures/xiaomi-mimo.html", "utf8");
const script = await readFile("tests/fixtures/xiaomi-mimo-list.txt", "utf8");
const references =
  "https://cdn.cnbj1.fds.api.mi-img.com/aife/mimo-blog-fe/doc_build/static/js/";
const assets = "https://mimo.xiaomi.com/static/js/";
const scripts = `<script src="${references}index.abcdef12.js"></script><script src="${references}4752.1234abcd.js"></script>`;
const runtime = '"static/js/async/"+e+"."+({7779:"abcdef01"})[e]+".js"';
const routes =
  'path:"/zh/",element:x,filePath:"zh/index.mdx",preload:async()=>(await x.preload(),Promise.all([t.e("9712"),t.e("7779")]).then(t.bind(t,64074))),lang:"zh"';
afterEach(() => vi.clearAllMocks());

describe("Xiaomi MiMo official blog", () => {
  it("extracts all 15 blog cards including collapsed entries, with real links and no paper/navigation entries", () => {
    const items = parseMiMoListing(html, script, source);
    expect(items).toHaveLength(15);
    expect(items[0]).toMatchObject({
      title: "MiMo-V2.6 工具调用重复问题复盘",
      url: "https://mimo.xiaomi.com/zh/blog/mimo-v2-6-tool-call-repetition",
      author: "Xiaomi MiMo Team",
    });
    expect(items[1].url).toBe("https://mimo.xiaomi.com/mimo-v2-6");
    expect(items.at(-1)?.url).toBe(
      "https://mimo.xiaomi.com/zh/blog/mimo-v2-flash-hss",
    );
    expect(items[0].publishedAt).toBeUndefined();
  });
  it("rejects mismatched deployments, empty shells, malformed batches and unrelated links", () => {
    for (const changed of [
      script.replace("MiMo-V2.6 工具调用重复问题复盘", "Changed title"),
      script.replace("link:", "other:"),
      script.replace(
        "/blog/mimo-v2-6-tool-call-repetition",
        "https://other.example/blog/article",
      ),
      script.replace("/blog/mimo-v2-6-tool-call-repetition", "/paper/article"),
    ])
      expect(() => parseMiMoListing(html, changed, source)).toThrow();
    expect(() =>
      parseMiMoListing("<div id=blog></div>", script, source),
    ).toThrow();
    expect(() => parseMiMoListing(html, "", source)).toThrow();
  });
  it("discovers changing asset hashes from the homepage and Chinese route without executing scripts", () => {
    expect(miMoScripts(scripts)).toEqual({
      runtime: `${assets}index.abcdef12.js`,
      routes: `${assets}4752.1234abcd.js`,
    });
    expect(miMoHomeScript(runtime, routes)).toBe(
      `${assets}async/7779.abcdef01.js`,
    );
    expect(() =>
      miMoScripts(scripts.replaceAll(references, "https://other.example/")),
    ).toThrow();
    expect(() =>
      miMoHomeScript(runtime, routes.replace("zh/index.mdx", "en/index.mdx")),
    ).toThrow();
  });
  it.each([
    ['datetime="2026-09-27"', "2026 年 9 月 27 日", "2026-09-26T16:00:00.000Z"],
    ['datetime="2026-05"', "2026 年 5 月 30 日", "2026-05-29T16:00:00.000Z"],
    ['datetime="2025-12"', "December 16, 2025", "2025-12-15T16:00:00.000Z"],
    ['datetime="2026-04"', "April 2026", undefined],
    ['datetime="2026-02-30"', "", undefined],
    ['datetime="2099-01-01"', "", undefined],
  ])(
    "reads full publication dates without inventing days: %s %s",
    (attr, text, expected) => {
      expect(
        parseMiMoMetadata(`<time class="hero-date" ${attr}>${text}</time>`)
          .publishedAt,
      ).toBe(expected);
    },
  );
  it("follows only the same-origin article wrapper, excluding videos and embedded demos", () => {
    const frame =
      '<iframe src="/mimo-v2-6-material-research/zh.html"></iframe>';
    const url = "https://mimo.xiaomi.com/zh/blog/mimo-v2-6-material-research";
    expect(miMoArticleFrame(frame, url)).toBe(
      "https://mimo.xiaomi.com/mimo-v2-6-material-research/zh.html",
    );
    expect(miMoArticleFrame("<h1>Article</h1>" + frame, url)).toBeUndefined();
    expect(
      miMoArticleFrame(
        '<iframe src="https://outside.example/mimo-v2-6/zh.html"></iframe>',
        url,
      ),
    ).toBeUndefined();
    expect(
      miMoArticleFrame(
        '<iframe src="/mimo-v2-flash/assets/cases/4.html"></iframe>',
        url,
      ),
    ).toBeUndefined();
  });
  it("requires the reviewed official source scope", () => {
    for (const patch of [
      { url: "https://tech.mi.com/blog" },
      { entryUrl: "https://other.example/" },
      { authorAllowlist: [] },
      { linkHosts: ["outside.example"] },
    ])
      expect(() => validateAccountScope({ ...source, ...patch })).toThrow();
  });
  it("routes real collection through the scripts and article iframe while retaining the Chinese listing title", async () => {
    const bodies = [
      html + scripts,
      runtime,
      routes,
      script,
      '<html lang="zh"><h1>Article</h1><time class="hero-date" datetime="2026-09-27"></time></html>',
      '<iframe src="/mimo-v2-6/article.html"></iframe>',
      '<html lang="en"><h1>Introducing MiMo</h1><time class="hero-date" datetime="2026-09-22"></time><p>FULL ARTICLE MUST NOT BE STORED</p></html>',
    ];
    const fetch = vi.mocked(fetchReviewed);
    for (const text of bodies)
      fetch.mockResolvedValueOnce({ status: 200, text, url: source.url });
    const result = await collect(
      source,
      {
        sourceId: source.id,
        status: "new",
        consecutiveFailures: 0,
        discovered: 0,
      },
      2,
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({
      title: "Xiaomi MiMo-V2.6 系列发布",
      publishedAt: "2026-09-21T16:00:00.000Z",
      language: "en",
    });
    expect(result.warnings).toEqual([]);
    expect(
      fetch.mock.calls.every(
        ([url]) => new URL(url).origin === "https://mimo.xiaomi.com",
      ),
    ).toBe(true);
    expect(JSON.stringify(result.items)).not.toContain("FULL ARTICLE");
    expect(fetch.mock.calls.at(-1)?.[0]).toBe(
      "https://mimo.xiaomi.com/mimo-v2-6/article.html",
    );
  });
});
