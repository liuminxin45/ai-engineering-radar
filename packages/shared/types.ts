import { z } from "zod";

export const topics = [
  { id: "agent", name: "Agent" },
  { id: "ai-coding", name: "AI Coding" },
  { id: "harness", name: "Harness" },
  { id: "rag", name: "RAG" },
  { id: "inference", name: "推理与部署" },
  { id: "evaluation", name: "评测与质量" },
  { id: "ai-infra", name: "AI 基础设施" },
  { id: "ai-application", name: "AI 应用" },
] as const;
export const topicIds = topics.map((t) => t.id);
const timestamp = z.string().datetime({ offset: true });
export const classificationSchema = z
  .object({
    status: z.enum(["pending", "accepted", "rejected", "review"]),
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
      .max(4),
    primaryTopic: z
      .enum([
        "agent",
        "ai-coding",
        "harness",
        "rag",
        "inference",
        "evaluation",
        "ai-infra",
        "ai-application",
      ])
      .optional(),
    reason: z.string().min(1).max(1000),
    evidence: z.array(z.string().max(300)).max(10),
    method: z.enum(["rules", "model", "manual"]),
    version: z.string(),
    classifiedAt: timestamp,
    model: z.string().optional(),
    promptVersion: z.string().optional(),
  })
  .refine(
    (c) => !c.primaryTopic || c.topics.includes(c.primaryTopic),
    "Primary topic must be included",
  );
export type Classification = z.infer<typeof classificationSchema>;
export const locationSchema = z.object({
  sourceId: z.string(),
  externalId: z.string().optional(),
  url: z.string().url(),
});
export const articleSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{20}$/),
  publisherId: z.string(),
  companyId: z.string(),
  title: z.string().min(1).max(600),
  canonicalUrl: z.string().url(),
  author: z.string().max(300).optional(),
  description: z.string().max(800).optional(),
  language: z.string().optional(),
  publishedAt: timestamp.optional(),
  discoveredAt: timestamp,
  updatedAt: timestamp,
  classification: classificationSchema,
  publicationStatus: z.enum(["draft", "published", "hidden"]),
  locations: z.array(locationSchema).min(1),
  duplicateCandidates: z.array(z.string()).default([]),
});
export type Article = z.infer<typeof articleSchema>;
export interface Company {
  id: string;
  name: string;
  region: "cn" | "global";
}
export interface Publisher {
  id: string;
  companyId: string;
  name: string;
}
export const sourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    publisherId: z.string(),
    name: z.string(),
    entryUrl: z.string().url(),
    url: z.string().url(),
    priority: z.enum(["A", "B", "C"]),
    adapter: z.enum(["feed", "html", "reference"]),
    platform: z.string(),
    verification: z.object({
      status: z.enum(["verified", "pending", "rejected", "suspended"]),
      evidenceUrls: z.array(z.string().url()),
      note: z.string(),
      reviewedAt: timestamp.nullable(),
    }),
    crawl: z.object({
      enabled: z.boolean(),
      intervalMinutes: z.number().positive(),
      maxItems: z.number().positive(),
      backfillLimit: z.number().positive(),
    }),
    selector: z.string().optional(),
    linkPattern: z.string().optional(),
    authorAllowlist: z.array(z.string()).optional(),
    linkHosts: z.array(z.string()).optional(),
    metadata: z
      .object({
        dateSelector: z.string().optional(),
        timezone: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((s, ctx) => {
    if (
      s.verification.status === "verified" &&
      (!s.verification.evidenceUrls.length ||
        !s.verification.reviewedAt ||
        s.verification.note.length < 12)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Verified sources require evidence, review time and explanation",
      });
    if (
      s.crawl.enabled &&
      (s.verification.status !== "verified" || s.adapter === "reference")
    )
      ctx.addIssue({
        code: "custom",
        message: "Only verified, collectable sources may be enabled",
      });
    if (
      s.platform === "community" &&
      s.crawl.enabled &&
      !s.authorAllowlist?.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Community sources need an official publisher allowlist",
      });
  });
export type Source = z.infer<typeof sourceSchema>;
export interface Candidate {
  title: string;
  url: string;
  externalId?: string;
  canonicalUrl?: string;
  author?: string;
  description?: string;
  publishedAt?: string;
  language?: string;
}
export const sourceStateSchema = z.object({
  sourceId: z.string(),
  lastCheckedAt: timestamp.optional(),
  lastSuccessAt: timestamp.optional(),
  nextRunAt: timestamp.optional(),
  consecutiveFailures: z.number().int().nonnegative().default(0),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  status: z.enum([
    "new",
    "success",
    "not-modified",
    "failed",
    "blocked",
    "pending",
    "reference",
  ]),
  error: z.string().optional(),
  discovered: z.number().int().nonnegative().default(0),
  httpStatus: z.number().optional(),
});
export type SourceState = z.infer<typeof sourceStateSchema>;
export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: timestamp,
  articleCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});
export type Manifest = z.infer<typeof manifestSchema>;
export interface Snapshot {
  manifest: Manifest;
  articles: Article[];
  states: SourceState[];
}
export const effectiveDate = (a: Article) => a.publishedAt ?? a.discoveredAt;
export const compareArticles = (a: Article, b: Article) =>
  effectiveDate(b).localeCompare(effectiveDate(a)) || b.id.localeCompare(a.id);
