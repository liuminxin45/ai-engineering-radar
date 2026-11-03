import { describe, it, expect } from "vitest";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XMLValidator } from "fast-xml-parser";
import { loadRegistry } from "../../packages/source-registry/index.js";
import { sourceSchema } from "../../packages/shared/types.js";
import {
  normalizeUrl,
  upsert,
  similar,
} from "../../packages/crawler/deduplicate.js";
import {
  parseFeed,
  parseMetadata,
  parseListing,
  parseTencentColumn,
  date,
} from "../../packages/crawler/adapters.js";
import { indexOfficialArticle } from "../../packages/classifier/index.js";
import {
  loadSnapshot,
  saveSnapshot,
  withSnapshotLock,
} from "../../packages/database/snapshot.js";
import {
  makeFeed,
  publishedArticles,
} from "../../packages/publisher/export.js";
import { isPublicAddress } from "../../packages/crawler/http.js";
import type { Article } from "../../packages/shared/types.js";
const registry = await loadRegistry(),
  source = registry.sources.find((s) => s.id === "meituan")!;
const candidate = {
  title: "Building reliable AI agents with sandbox architecture",
  url: "https://tech.meituan.com/agent?utm_source=x",
  externalId: "guid-1",
  description:
    "We implemented a tool calling runtime and evaluated context pipeline latency.",
  publishedAt: "2026-10-30T00:00:00.000Z",
};
describe("registry and identity", () => {
  it("keeps the expected verified blog sources", () =>
    expect(
      registry.sources.filter((s) => s.contentType !== "paper").length,
    ).toBe(10));
  it("rejects verified records without evidence", () =>
    expect(() =>
      sourceSchema.parse({
        ...source,
        verification: { ...source.verification, evidenceUrls: [] },
      }),
    ).toThrow());
  it("never enables unverified community accounts", () => {
    for (const s of registry.sources.filter((s) => s.platform === "community"))
      if (s.crawl.enabled) expect(s.authorAllowlist?.length).toBeGreaterThan(0);
  });
  it("keeps Dewu publisher separate from Tencent", () => {
    const s = registry.sources.find((s) => s.id === "dewu-tencent")!;
    expect(
      registry.publishers.find((p) => p.id === s.publisherId)?.companyId,
    ).toBe("dewu");
  });
});
describe("normalization and deduplication", () => {
  it("removes tracking only, preserves semantic queries", () =>
    expect(
      normalizeUrl("https://EXAMPLE.com/post/?utm_source=x&id=2&gclid=x#top"),
    ).toBe("https://example.com/post?id=2"));
  it("is idempotent across overlapping runs", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    const id = a[0].id;
    upsert(a, candidate, source, registry);
    expect(a).toHaveLength(1);
    expect(a[0].id).toBe(id);
    expect(a[0].locations).toHaveLength(1);
  });
  it("uses GUID when the URL changes", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    upsert(
      a,
      { ...candidate, url: "https://tech.meituan.com/new" },
      source,
      registry,
    );
    expect(a).toHaveLength(1);
  });
  it("merges canonical crossposts and preserves source locations", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    const mirror = { ...source, id: "mirror" };
    upsert(
      a,
      {
        ...candidate,
        url: "https://mirror.example/agent",
        canonicalUrl: candidate.url,
      },
      mirror,
      registry,
    );
    expect(a).toHaveLength(1);
    expect(a[0].locations).toHaveLength(2);
  });
  it("does not merge uncertain similar titles", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    upsert(
      a,
      {
        ...candidate,
        url: "https://tech.meituan.com/agent-2",
        externalId: "different",
      },
      source,
      registry,
    );
    expect(a).toHaveLength(2);
    expect(a[1].classification.status).toBe("accepted");
  });
  it("recognizes multilingual title similarity", () =>
    expect(
      similar("构建可靠的 AI Agent 工程架构", "构建可靠的AI Agent工程架构！"),
    ).toBe(true));
  it("updates metadata while preserving stable ID", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    const id = a[0].id;
    upsert(
      a,
      { ...candidate, title: candidate.title + " revised" },
      source,
      registry,
    );
    expect(a[0].id).toBe(id);
    expect(a[0].title).toContain("revised");
  });
});
describe("adapters", () => {
  it("filters Tencent column items by stable publisher UID", () => {
    const s = registry.sources.find((s) => s.id === "dewu-tencent")!;
    const page = {
      props: {
        pageProps: {
          fallback: {
            "/api/column/getArticlesByColumnId": [
              {
                list: [
                  {
                    articleId: 1,
                    title: "Building AI agent sandbox runtime",
                    uid: 9927536,
                    author: { uid: 9927536, nickname: "得物技术" },
                    summary: "Implementation details",
                    createTime: "2026/10/29 10:45:34",
                  },
                  {
                    articleId: 2,
                    title: "Impersonator",
                    uid: 123,
                    author: { uid: 123, nickname: "得物技术" },
                  },
                ],
              },
            ],
          },
        },
      },
    };
    const items = parseTencentColumn(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(page)}</script>`,
      s,
    );
    expect(items).toHaveLength(1);
    expect(items[0].publishedAt).toBe("2026-10-29T02:45:34.000Z");
  });
  it("reads site-specific dates and skips empty duplicate metadata", () => {
    const result = parseMetadata(
      '<meta name="description" content=""><meta name="description" content="Real summary"><span class="created-at">2026-06-09 10:57:59</span>',
      "https://tech.dewu.com/article?id=1",
      {
        ...source,
        metadata: { dateSelector: ".created-at", timezone: "+08:00" },
      },
    );
    expect(result.description).toBe("Real summary");
    expect(result.publishedAt).toBe("2026-06-09T02:57:59.000Z");
  });
  it("parses RSS with escaped XML", async () => {
    const items = parseFeed(
      await readFile("tests/fixtures/rss.xml", "utf8"),
      source,
    );
    expect(items[0].title).toContain("&");
    expect(items[0].externalId).toBe("stable-1");
  });
  it("parses Atom links, dates and authors", async () => {
    const items = parseFeed(
      await readFile("tests/fixtures/atom.xml", "utf8"),
      source,
    );
    expect(items[0].url).toBe("https://tech.meituan.com/rag");
    expect(items[0].author).toBe("Official Team");
  });
  it("rejects HTML masquerading as a feed", () =>
    expect(() => parseFeed("<html>Captcha</html>", source)).toThrow());
  it("enforces per-item community author identity", async () =>
    expect(
      parseFeed(await readFile("tests/fixtures/rss.xml", "utf8"), {
        ...source,
        authorAllowlist: ["Another Team"],
      }),
    ).toHaveLength(0));
  it("extracts only metadata from a page", () => {
    const m = parseMetadata(
      '<html lang="en"><head><meta name="description" content="Short summary"><link rel="canonical" href="/original"></head><body><h1>Title</h1><p>PRIVATE FULL BODY</p></body></html>',
      "https://tech.meituan.com/post",
    );
    expect(m.description).toBe("Short summary");
    expect(JSON.stringify(m)).not.toContain("PRIVATE FULL BODY");
    expect(m.canonicalUrl).toBe("https://tech.meituan.com/original");
  });
  it("uses source-specific HTML selectors", () =>
    expect(
      parseListing(
        '<a href="/news">Ignore</a><article><a href="/engineering/building-agent"><h2>Building reliable agents</h2></a><p>A sandbox runtime</p></article>',
        { ...source, adapter: "html", selector: 'a[href*="/engineering/"]' },
      ),
    ).toHaveLength(1));
  it("does not invent missing publication dates", () => {
    expect(date("garbage")).toBeUndefined();
    expect(date(undefined)).toBeUndefined();
  });
});
describe("official-account publication", () => {
  it.each([
    "AI agent runtime architecture",
    "Redis 自动化运维最佳实践",
    "团队开源活动报名",
    "季度技术复盘",
  ])("indexes verified account content without keyword gates: %s", (title) => {
    const c = indexOfficialArticle({ title });
    expect(c.status).toBe("accepted");
    expect(c.method).toBe("source");
    expect(c.topics).toEqual([]);
  });
  it("excludes overseas company records from this release", () =>
    expect(registry.companies.every((c) => c.region === "cn")).toBe(true));
  it("hides articles when the only source loses verification", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    expect(publishedArticles(a, registry)).toHaveLength(1);
    const revoked = {
      ...registry,
      sources: registry.sources.map((s) =>
        s.id === source.id
          ? {
              ...s,
              verification: { ...s.verification, status: "rejected" as const },
            }
          : s,
      ),
    };
    expect(publishedArticles(a, revoked)).toHaveLength(0);
  });
  it("keeps old publications for suspended sources", () => {
    const a: Article[] = [];
    upsert(a, candidate, source, registry);
    const suspended = {
      ...registry,
      sources: registry.sources.map((s) =>
        s.id === source.id
          ? {
              ...s,
              verification: { ...s.verification, status: "suspended" as const },
            }
          : s,
      ),
    };
    expect(publishedArticles(a, suspended)).toHaveLength(1);
  });
});
describe("snapshots and feeds", () => {
  it("rejects concurrent writers and releases the lock", async () => {
    const parent = await mkdtemp(join(tmpdir(), "radar-lock-"));
    try {
      const dir = join(parent, "data");
      await withSnapshotLock(dir, async () => {
        await expect(withSnapshotLock(dir, async () => {})).rejects.toThrow(
          "locked",
        );
      });
      await expect(withSnapshotLock(dir, async () => 42)).resolves.toBe(42);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
  it("roundtrips JSON and detects corruption without reset", async () => {
    const parent = await mkdtemp(join(tmpdir(), "radar-test-")),
      dir = join(parent, "data");
    try {
      const a: Article[] = [];
      upsert(a, candidate, source, registry);
      await saveSnapshot(dir, a, [], registry);
      expect((await loadSnapshot(dir, registry)).articles[0].id).toBe(a[0].id);
      await writeFile(
        join(dir, "articles", `${source.publisherId}.json`),
        "{}",
      );
      await expect(loadSnapshot(dir, registry)).rejects.toThrow("checksum");
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
  it("rejects unsupported schema versions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "radar-schema-"));
    try {
      await writeFile(
        join(dir, "manifest.json"),
        JSON.stringify({ schemaVersion: 9 }),
      );
      await expect(loadSnapshot(dir, registry)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("produces escaped RSS and Atom with stable IDs and subpath", () => {
    const a: Article[] = [];
    upsert(
      a,
      { ...candidate, title: "Building AI agents & sandbox <runtime>" },
      source,
      registry,
    );
    const feed = makeFeed(
      a,
      "Radar",
      "https://example.com/radar",
      "feed.xml",
      registry,
      "2026-11-01T00:00:00.000Z",
    );
    for (const xml of [feed.rss2(), feed.atom1()]) {
      expect(XMLValidator.validate(xml)).toBe(true);
      expect(xml).toContain(`/radar/articles/${a[0].id}/`);
      expect(xml).toContain(`urn:ai-engineering-radar:article:${a[0].id}`);
      expect(xml).not.toContain("PRIVATE FULL BODY");
    }
  });
  it("blocks private and loopback network ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.2.3.4",
      "192.168.1.2",
      "169.254.169.254",
      "::1",
      "fc00::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress("1.1.1.1")).toBe(true);
  });
});
