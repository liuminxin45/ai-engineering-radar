import { createHash } from "node:crypto";
import {
  ENGINE_VERSION,
  articleParser,
  type ParsedArticle,
} from "../article-parser/index.js";
import { articleBodySchema, type ArticleBody } from "../shared/article-body.js";
import type { Article, Source } from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import { createBodyLoader } from "./body-fetchers.js";
import { compareArticles } from "../shared/types.js";

export type BodyLoader = (
  article: Article,
  source: Source,
  url: string,
) => Promise<ParsedArticle>;
export async function collectBodies(
  articles: Article[],
  previous: ArticleBody[],
  registry: Registry,
  options: {
    force?: boolean;
    retryUnavailable?: boolean;
    incremental?: boolean;
    changedArticleIds?: string[];
    sourceId?: string;
    limit?: number;
    loader?: BodyLoader;
    onProgress?: (bodies: ArticleBody[], attempted: number) => Promise<void>;
  } = {},
) {
  if (
    options.sourceId &&
    !registry.sources.some((source) => source.id === options.sourceId)
  )
    throw new Error("Unknown body source id");
  const published = articles.filter(
    (a) =>
      a.contentType !== "paper" &&
      a.publicationStatus === "published" &&
      a.classification.status === "accepted",
  );
  const bodies = new Map(
    previous
      .filter((body) =>
        articles.some(
          (a) =>
            a.id === body.articleId &&
            a.locations.some((l) => l.sourceId === body.sourceId),
        ),
      )
      .map((body) => [body.articleId, body]),
  );
  const now = new Date().toISOString();
  const changed = new Set(options.changedArticleIds ?? []);
  for (const article of published) {
    const body = bodies.get(article.id);
    if (changed.has(article.id) && body?.html)
      bodies.set(article.id, { ...body, refreshPending: true });
  }
  const queue = published
    .filter((article) => {
      if (
        options.sourceId &&
        !article.locations.some((l) => l.sourceId === options.sourceId)
      )
        return false;
      const body = bodies.get(article.id);
      if (options.force) return true;
      if (body?.ruleId === "readability" && articleParser.match(body.sourceUrl))
        return true;
      if (options.incremental) {
        // Successful unchanged bodies do not expire during the daily sweep.
        // Every failure is retried next run, including failed refreshes that
        // retained old HTML, and partial bodies awaiting a complete version.
        if (
          !body ||
          body.status !== "ready" ||
          body.error ||
          body.refreshPending ||
          changed.has(article.id)
        )
          return true;
        if (body.engineVersion !== ENGINE_VERSION) return true;
        return (
          !!body.ruleId &&
          body.ruleVersion !== articleParser.revision(body.ruleId)
        );
      }
      if (
        body?.ruleId &&
        body.ruleVersion !== articleParser.revision(body.ruleId)
      )
        return true;
      if (options.retryUnavailable && body?.status === "unavailable")
        return true;
      if (!body || body.engineVersion !== ENGINE_VERSION) return true;
      if (body.nextRetryAt) return body.nextRetryAt <= now;
      return false;
    })
    .sort((a, b) => {
      if (!options.incremental) return compareArticles(a, b);
      const priority = (article: Article) =>
        !bodies.has(article.id) ? 0 : changed.has(article.id) ? 1 : 2;
      return (
        priority(a) - priority(b) ||
        (bodies.get(a.id)?.checkedAt ?? "").localeCompare(
          bodies.get(b.id)?.checkedAt ?? "",
        ) ||
        compareArticles(a, b)
      );
    })
    .slice(0, options.limit ?? Infinity);
  if (options.force)
    for (const article of queue) {
      const body = bodies.get(article.id);
      if (body?.html) bodies.set(article.id, { ...body, refreshPending: true });
    }
  const load = options.loader || createBodyLoader();
  let attempted = 0,
    ready = 0,
    partial = 0,
    unavailable = 0;
  // Checkpoints are serialized so a slower save cannot overwrite newer results.
  let checkpoint = Promise.resolve();
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const article = queue.shift()!;
        const existing = bodies.get(article.id);
        let error: string | undefined, result: ArticleBody | undefined;
        let fallback =
          existing?.ruleId === "readability" &&
          articleParser.match(existing.sourceUrl)
            ? undefined
            : existing;
        for (const location of article.locations) {
          const source = registry.sources.find(
            (source) =>
              source.id === location.sourceId &&
              source.crawl.enabled &&
              source.verification.status === "verified",
          );
          if (!source || (options.sourceId && source.id !== options.sourceId))
            continue;
          try {
            const parsed = await load(article, source, location.url);
            const checkedAt = new Date().toISOString();
            const next = articleBodySchema.parse({
              articleId: article.id,
              status: parsed.status,
              html: parsed.html,
              headings: parsed.headings,
              textLength: parsed.textLength,
              readingMinutes: parsed.readingMinutes,
              sourceId: source.id,
              sourceUrl: parsed.sourceUrl,
              ruleId: parsed.ruleId,
              ruleVersion: parsed.ruleVersion,
              engineVersion: ENGINE_VERSION,
              contentHash: createHash("sha256")
                .update(parsed.html)
                .digest("hex"),
              checkedAt,
              fetchedAt: checkedAt,
              nextRetryAt: new Date(
                Date.now() + (parsed.status === "ready" ? 30 : 7) * 86400000,
              ).toISOString(),
              warnings: parsed.warnings,
            });
            if (next.status === "ready") {
              result = next;
              break;
            }
            if (
              !fallback?.html ||
              fallback.ruleVersion !==
                articleParser.revision(fallback.ruleId || "") ||
              fallback.engineVersion !== ENGINE_VERSION ||
              (fallback.status !== "ready" &&
                next.textLength > fallback.textLength)
            )
              fallback = next;
          } catch (failure) {
            error =
              failure instanceof Error
                ? failure.message.slice(0, 500)
                : "正文获取失败。";
          }
        }
        result ||= fallback?.html
          ? {
              ...fallback,
              checkedAt: new Date().toISOString(),
              error,
              nextRetryAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            }
          : articleBodySchema.parse({
              articleId: article.id,
              status: "unavailable",
              sourceId: article.locations[0].sourceId,
              sourceUrl: article.locations[0].url,
              engineVersion: ENGINE_VERSION,
              checkedAt: new Date().toISOString(),
              nextRetryAt: new Date(Date.now() + 7 * 86400000).toISOString(),
              error: error || "没有可用的正文来源。",
            });
        bodies.set(article.id, result);
        attempted++;
        if (result.status === "ready") ready++;
        else if (result.status === "partial") partial++;
        else unavailable++;
        console.log(
          `Body ${attempted}: ${article.id} ${result.status} ${result.textLength} chars${result.error ? ` (${result.error})` : ""}`,
        );
        if (options.onProgress && attempted % 20 === 0) {
          const captured = [...bodies.values()];
          const count = attempted;
          checkpoint = checkpoint.then(() =>
            options.onProgress!(captured, count),
          );
          await checkpoint;
        }
      }
    }),
  );
  await checkpoint;
  return {
    bodies: [...bodies.values()],
    attempted,
    ready,
    partial,
    unavailable,
  };
}
