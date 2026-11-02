import { z } from "zod";

export const articleBodySchema = z
  .object({
    articleId: z.string().regex(/^[a-f0-9]{20}$/),
    status: z.enum(["ready", "partial", "unavailable"]),
    html: z
      .string()
      .max(4 * 1024 * 1024)
      .default(""),
    headings: z
      .array(
        z.object({
          id: z.string(),
          level: z.number().int().min(2).max(3),
          text: z.string(),
        }),
      )
      .default([]),
    textLength: z.number().int().nonnegative().default(0),
    readingMinutes: z.number().int().nonnegative().default(0),
    sourceId: z.string(),
    sourceUrl: z.string().url(),
    ruleId: z.string().optional(),
    ruleVersion: z.string().optional(),
    engineVersion: z.string(),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    fetchedAt: z.string().datetime({ offset: true }).optional(),
    checkedAt: z.string().datetime({ offset: true }),
    nextRetryAt: z.string().datetime({ offset: true }).optional(),
    error: z.string().max(500).optional(),
    refreshPending: z.boolean().optional(),
    warnings: z.array(z.string()).default([]),
  })
  .superRefine((body, context) => {
    if (
      body.status !== "unavailable" &&
      (!body.html || !body.contentHash || !body.fetchedAt)
    )
      context.addIssue({
        code: "custom",
        message: "Readable bodies require HTML, a checksum and fetch time",
      });
    if (body.status === "unavailable" && (body.html || body.headings.length))
      context.addIssue({
        code: "custom",
        message: "Unavailable bodies cannot publish content",
      });
  });

export type ArticleBody = z.infer<typeof articleBodySchema>;
