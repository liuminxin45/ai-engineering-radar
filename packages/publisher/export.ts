import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Feed } from "feed";
import type { Article, Snapshot } from "../shared/types.js";
import {
  articleCompanyIds,
  compareArticles,
  effectiveDate,
  topics,
} from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
export function publishedArticles(articles: Article[], registry: Registry) {
  return articles
    .filter(
      (a) =>
        registry.companies.some(
          (c) => c.id === a.companyId && c.region === "cn",
        ) &&
        articleCompanyIds(a).every((id) =>
          registry.companies.some((c) => c.id === id && c.region === "cn"),
        ) &&
        a.publicationStatus === "published" &&
        a.classification.status === "accepted" &&
        a.locations.some((l) => {
          const s = registry.sources.find((s) => s.id === l.sourceId);
          return s && ["verified", "suspended"].includes(s.verification.status);
        }),
    )
    .sort(compareArticles);
}
export function makeFeed(
  articles: Article[],
  title: string,
  siteUrl: string,
  path: string,
  registry: Registry,
  updated: string,
) {
  const url = siteUrl.replace(/\/$/, "");
  const feed = new Feed({
    title,
    description: "国内公司官方技术账号文章索引",
    id: `${url}/${path.replace(/\.(xml|atom)$/, "")}`,
    link: url,
    language: "zh-CN",
    copyright: "文章及摘要版权归原作者；本站只提供索引。",
    updated: new Date(updated),
    feedLinks: {
      rss2: `${url}/${path.replace(/\.atom$/, ".xml")}`,
      atom: `${url}/${path.replace(/\.xml$/, ".atom")}`,
    },
  });
  for (const a of articles.slice(0, 50)) {
    const company = registry.companies.find((c) => c.id === a.companyId)!;
    const affiliations = articleCompanyIds(a)
      .map((id) => registry.companies.find((c) => c.id === id)?.name ?? id)
      .join("、");
    feed.addItem({
      id: `urn:ai-engineering-radar:article:${a.id}`,
      title: a.title,
      link: `${url}/articles/${a.id}/`,
      description: `${a.description ?? a.classification.reason}\n\n${a.contentType === "paper" ? "公司归属" : "来源"}：${affiliations} · 原文：${a.canonicalUrl}`,
      date: new Date(effectiveDate(a)),
      author: [{ name: a.author ?? company.name, link: a.canonicalUrl }],
      category: a.classification.topics.map((id) => ({
        name: topics.find((t) => t.id === id)!.name,
      })),
      content: undefined,
    });
  }
  return feed;
}
export async function exportSite(
  snapshot: Snapshot,
  registry: Registry,
  root: string,
  siteUrl: string,
) {
  const articles = publishedArticles(snapshot.articles, registry);
  const generatedAt = snapshot.manifest.generatedAt;
  const publicDir = join(root, "apps/web/public");
  const dataDir = join(publicDir, "data");
  await rm(dataDir, { recursive: true, force: true });
  await rm(join(publicDir, "feed"), { recursive: true, force: true });
  await mkdir(join(dataDir, "articles"), { recursive: true });
  await mkdir(join(root, "apps/web/src/generated"), { recursive: true });
  const generatedBodies = join(root, "apps/web/src/generated/bodies");
  await rm(generatedBodies, { recursive: true, force: true });
  await mkdir(generatedBodies, { recursive: true });
  await mkdir(join(dataDir, "bodies"), { recursive: true });
  const sources = registry.sources.map((s) => ({
    ...s,
    latestPublishedAt:
      articles
        .filter((a) => a.locations.some((l) => l.sourceId === s.id))
        .map((a) => a.publishedAt)
        .filter((value): value is string => !!value)
        .sort()
        .at(-1) ?? null,
    state: snapshot.states.find((state) => state.sourceId === s.id) ?? {
      sourceId: s.id,
      status: "new",
      consecutiveFailures: 0,
      discovered: 0,
    },
  }));
  const health = {
    schemaVersion: 1,
    generatedAt,
    articleCount: articles.length,
    sourceCount: sources.length,
    bodyCount: (snapshot.bodies ?? []).filter((body) =>
      articles.some((a) => a.id === body.articleId),
    ).length,
    readableBodyCount: (snapshot.bodies ?? []).filter(
      (body) =>
        body.status !== "unavailable" &&
        articles.some((a) => a.id === body.articleId),
    ).length,
    enabledSources: sources.filter((s) => s.crawl.enabled).length,
    successfulSources: sources.filter(
      (s) =>
        s.crawl.enabled && ["success", "not-modified"].includes(s.state.status),
    ).length,
    failedSources: sources.filter(
      (s) => s.crawl.enabled && ["failed", "blocked"].includes(s.state.status),
    ).length,
    lastSuccessAt:
      snapshot.states
        .map((s) => s.lastSuccessAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
  const bundle = {
    schemaVersion: 1,
    generatedAt,
    articles,
    companies: registry.companies,
    publishers: registry.publishers,
    topics: [],
    sources,
    health,
  };
  const put = async (path: string, data: unknown) =>
    writeFile(path, JSON.stringify(data, null, 2) + "\n");
  await put(join(root, "apps/web/src/generated/site.json"), bundle);
  await put(join(dataDir, "articles.json"), {
    schemaVersion: 1,
    generatedAt,
    articles,
  });
  for (const a of articles)
    await put(join(dataDir, "articles", `${a.id}.json`), {
      schemaVersion: 1,
      article: a,
    });
  for (const body of snapshot.bodies ?? []) {
    if (!articles.some((article) => article.id === body.articleId)) continue;
    const payload = { schemaVersion: 1, body };
    await put(join(generatedBodies, `${body.articleId}.json`), payload);
    await put(join(dataDir, "bodies", `${body.articleId}.json`), payload);
  }
  await put(join(dataDir, "bodies.json"), {
    schemaVersion: 1,
    generatedAt,
    bodies: (snapshot.bodies ?? [])
      .filter((body) =>
        articles.some((article) => article.id === body.articleId),
      )
      .map((body) => ({
        articleId: body.articleId,
        status: body.status,
        readingMinutes: body.readingMinutes,
        headingCount: body.headings.length,
        imageCount: (body.html.match(/<img\b/g) || []).length,
        fetchedAt: body.fetchedAt,
      })),
  });
  for (const [name, data] of Object.entries({
    companies: registry.companies,
    topics: [],
    sources,
    health,
  }))
    await put(join(dataDir, `${name}.json`), {
      schemaVersion: 1,
      generatedAt,
      [name]: data,
    });
  async function feeds(path: string, title: string, items: Article[]) {
    await mkdir(join(publicDir, path, ".."), { recursive: true });
    const feed = makeFeed(
      items,
      title,
      siteUrl,
      `${path}.xml`,
      registry,
      generatedAt,
    );
    await writeFile(join(publicDir, `${path}.xml`), feed.rss2());
    await writeFile(join(publicDir, `${path}.atom`), feed.atom1());
  }
  await feeds("feed", "AI Engineering Radar", articles);
  const lines = [
    "# 来源验收表",
    "",
    `快照时间：${generatedAt}`,
    "",
    "| 入口 | 身份 | 启用 | 实测状态 | 条目数 | 最新文章 | 最近成功 | 说明 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...sources.map(
      (s) =>
        `| [${s.name}](${s.entryUrl}) | ${s.verification.status} | ${s.crawl.enabled ? "是" : "否"} | ${s.state.status} | ${s.state.discovered} | ${s.latestPublishedAt ?? "—"} | ${s.state.lastSuccessAt ?? "—"} | ${(s.state.error ?? s.verification.note).replace(/\|/g, "／").replace(/\n/g, " ")} |`,
    ),
  ];
  await mkdir(join(root, "work"), { recursive: true });
  await writeFile(
    join(root, "work/source-acceptance.md"),
    lines.join("\n") + "\n",
  );
  console.log(
    `Exported ${articles.length} published articles, ${sources.length} sources, RSS + Atom`,
  );
}
