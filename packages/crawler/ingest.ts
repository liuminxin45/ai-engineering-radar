import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Article, Snapshot, SourceState } from "../shared/types.js";
import type { Registry } from "../source-registry/index.js";
import {
  classificationSchema,
  articleSchema,
  contentTypeSchema,
  companyIdsSchema,
  paperAffiliationSchema,
} from "../shared/types.js";
import { indexOfficialArticle } from "../classifier/index.js";
import {
  assessAdvertorial,
  markAdvertorials,
} from "../classifier/advertorial.js";
import { upsert } from "./deduplicate.js";
import { collect } from "./adapters.js";
import { CrawlError, fetchReviewed } from "./http.js";

export async function applyOverrides(articles: Article[]) {
  const raw = JSON.parse(
    await readFile(
      new URL("../../config/overrides.json", import.meta.url),
      "utf8",
    ),
  );
  // Validate every override before applying it; never silently skip stale identifiers.
  if (raw.schemaVersion !== 1 || !raw.articles || !Array.isArray(raw.merges))
    throw new Error("Invalid override schema");
  for (const article of articles)
    if (
      article.advertorial?.method === "manual" &&
      raw.articles[article.id]?.advertorial === undefined
    )
      article.advertorial = assessAdvertorial({
        ...article,
        advertorial: undefined,
      });
  for (const [id, value] of Object.entries(raw.articles)) {
    const o = z
      .object({
        status: z.enum(["accepted", "rejected", "review"]).optional(),
        hidden: z.boolean().optional(),
        contentType: contentTypeSchema.optional(),
        companyIds: companyIdsSchema.optional(),
        paperAffiliations: z.array(paperAffiliationSchema).min(1).optional(),
        advertorial: z.enum(["suspected", "cleared"]).optional(),
        topics: z
          .array(
            z.enum([
              "agent",
              "ai-coding",
              "harness",
              "rag",
              "inference",
              "evaluation",
              "ai-infra",
              "ai-application",
            ]),
          )
          .max(4)
          .optional(),
        reason: z.string().min(1),
      })
      .strict()
      .parse(value);
    const a = articles.find((a) => a.id === id);
    if (!a) throw new Error(`Override references missing article ${id}`);
    if (
      o.contentType !== undefined ||
      o.companyIds !== undefined ||
      o.paperAffiliations !== undefined
    ) {
      const updated = articleSchema.parse({
        ...a,
        contentType: o.contentType ?? a.contentType,
        companyIds:
          o.contentType === "blog" ? undefined : (o.companyIds ?? a.companyIds),
        paperAffiliations:
          o.contentType === "blog"
            ? undefined
            : (o.paperAffiliations ??
              a.paperAffiliations?.filter((p) =>
                (o.companyIds ?? a.companyIds)?.includes(p.companyId),
              )),
      });
      a.contentType = updated.contentType;
      a.companyIds = updated.companyIds;
      a.paperAffiliations = updated.paperAffiliations;
    }
    if (o.advertorial) {
      a.advertorial = {
        status: o.advertorial,
        method: "manual",
        basis: "manual-review",
        reason: o.reason,
        evidence: [],
        version: "advertorial-manual-1",
      };
    }
    // A label correction must not change collection or publication decisions.
    if (
      o.advertorial &&
      o.status === undefined &&
      o.hidden === undefined &&
      o.topics === undefined
    )
      continue;
    a.classification = {
      ...a.classification,
      status: o.status ?? a.classification.status,
      topics: o.topics ?? a.classification.topics,
      primaryTopic: (o.topics ?? a.classification.topics)[0],
      method: "manual",
      version: "manual-1",
      reason: o.reason,
      classifiedAt:
        a.classification.method === "manual" &&
        a.classification.reason === o.reason
          ? a.classification.classifiedAt
          : new Date().toISOString(),
    };
    a.publicationStatus = o.hidden
      ? "hidden"
      : a.classification.status === "accepted"
        ? "published"
        : "draft";
  }
  for (const value of raw.merges) {
    const m = z
      .object({ from: z.string(), into: z.string(), reason: z.string().min(1) })
      .strict()
      .parse(value);
    const from = articles.find((a) => a.id === m.from),
      into = articles.find((a) => a.id === m.into);
    if (
      !from ||
      !into ||
      from.id === into.id ||
      from.publisherId !== into.publisherId ||
      (from.contentType ?? "blog") !== (into.contentType ?? "blog")
    )
      throw new Error("Invalid manual merge");
    if (into.contentType === "paper") {
      into.companyIds = [
        ...new Set([...into.companyIds!, ...from.companyIds!]),
      ];
      if (into.paperAffiliations || from.paperAffiliations)
        into.paperAffiliations = [
          ...new Map(
            [
              ...(into.paperAffiliations ?? []),
              ...(from.paperAffiliations ?? []),
            ].map((p) => [`${p.companyId}:${p.evidenceUrl}`, p]),
          ).values(),
        ];
    }
    for (const l of from.locations)
      if (
        !into.locations.some(
          (x) => x.sourceId === l.sourceId && x.url === l.url,
        )
      )
        into.locations.push(l);
    // Retain a hidden audit record without duplicating source identifiers.
    from.locations = from.locations.map((l) => ({
      ...l,
      externalId: undefined,
    }));
    from.publicationStatus = "hidden";
    from.classification = {
      ...from.classification,
      method: "manual",
      reason: `合并至 ${into.id}：${m.reason}`,
      version: "manual-1",
    };
  }
}
export async function ingest(
  snapshot: Snapshot,
  registry: Registry,
  options: {
    force?: boolean;
    daily?: boolean;
    sourceId?: string;
    probe?: boolean;
    contentType?: "blog" | "paper";
  } = {},
) {
  const articles = structuredClone(snapshot.articles);
  const states = structuredClone(snapshot.states);
  let successes = 0,
    attempted = 0;
  const sources = registry.sources.filter(
    (s) =>
      (!options.sourceId || s.id === options.sourceId) &&
      (!options.contentType ||
        (s.contentType ?? "blog") === options.contentType),
  );
  if (options.sourceId && !sources.length) throw new Error("Unknown source id");
  const queue = [...sources];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) {
        const source = queue.shift()!;
        let state = states.find((s) => s.sourceId === source.id);
        if (!state) {
          state = {
            sourceId: source.id,
            consecutiveFailures: 0,
            status: "new",
            discovered: 0,
          };
          states.push(state);
        }
        if (source.verification.status === "suspended") {
          state.status = "suspended";
          state.error = source.verification.note;
          state.nextRunAt = undefined;
          continue;
        }
        if (
          !options.force &&
          !(options.daily && source.crawl.intervalMinutes <= 1440) &&
          state.nextRunAt &&
          state.nextRunAt > new Date().toISOString()
        )
          continue;
        const now = new Date().toISOString();
        state.lastCheckedAt = now;
        state.nextRunAt = new Date(
          Date.now() + source.crawl.intervalMinutes * 60000,
        ).toISOString();
        const enabled =
          source.crawl.enabled && source.verification.status === "verified";
        if (!enabled) {
          state.status =
            source.adapter === "reference" &&
            source.verification.status === "verified"
              ? "reference"
              : "pending";
          state.error = source.verification.note;
          if (options.probe)
            try {
              const response = await fetchReviewed(source.url, source);
              state.httpStatus = response.status;
              console.log(
                `${source.id}: ${state.status}, HTTP ${response.status}`,
              );
            } catch (error) {
              state.httpStatus =
                error instanceof CrawlError ? error.status : undefined;
              state.error = `${source.verification.note} 入口检测：${error instanceof CrawlError ? error.message : "网络请求失败"}`;
              console.log(`${source.id}: ${state.status}, ${state.error}`);
            }
          continue;
        }
        attempted++;
        try {
          const result = await collect(
            source,
            options.force
              ? { ...state, etag: undefined, lastModified: undefined }
              : state,
            state.lastSuccessAt
              ? source.crawl.maxItems
              : source.crawl.backfillLimit,
            {
              companyId: registry.publishers.find(
                (p) => p.id === source.publisherId,
              )!.companyId,
              articles,
            },
          );
          // Each source batch commits atomically; a malformed item cannot partially publish a failed run.
          const staged = structuredClone(articles);
          for (const item of result.items)
            upsert(staged, item, source, registry, now);
          articles.splice(0, articles.length, ...staged);
          state.status =
            result.response.status === 304 ? "not-modified" : "success";
          state.httpStatus = result.response.status;
          state.lastSuccessAt = now;
          state.consecutiveFailures = 0;
          state.discovered = result.items.length;
          state.error = result.warnings.length
            ? source.contentType === "paper"
              ? `${result.warnings.length} 条论文候选未取得可用归属证据，已跳过。`
              : `${result.warnings.length} 篇文章的补充元数据不可用；保留目录元数据。`
            : undefined;
          // Only replace validators after successful parsing and normalization.
          state.etag = result.response.etag ?? state.etag;
          state.lastModified =
            result.response.lastModified ?? state.lastModified;
          successes++;
          console.log(
            `${source.id}: ${state.status}, ${result.items.length} entries`,
          );
        } catch (error) {
          state.status =
            error instanceof CrawlError && error.blocked ? "blocked" : "failed";
          state.httpStatus =
            error instanceof CrawlError ? error.status : undefined;
          state.consecutiveFailures++;
          state.error =
            error instanceof CrawlError
              ? error.message
              : error instanceof Error && error.name === "AbortError"
                ? "请求超时"
                : "采集或解析失败，请检查适配器及网络。";
          state.nextRunAt = new Date(
            Date.now() +
              Math.min(
                source.crawl.intervalMinutes * 60000,
                3600000 * 2 ** Math.min(state.consecutiveFailures, 5),
              ),
          ).toISOString();
          console.log(`${source.id}: ${state.status}, ${state.error}`);
        }
      }
    }),
  );
  for (const article of articles) {
    if (article.publicationStatus === "hidden") continue;
    article.classification = indexOfficialArticle(article);
    article.publicationStatus = "published";
  }
  markAdvertorials(articles);
  await applyOverrides(articles);
  return { articles, states, successes, attempted };
}
