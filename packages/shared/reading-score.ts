import { z } from "zod";

export const readingScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  titleHash: z.string().regex(/^[a-f0-9]{64}$/),
  rubricVersion: z.string().min(1).max(100),
  provider: z.string().min(1).max(100),
  displayName: z.string().min(1).max(40),
  model: z.string().min(1).max(200),
  scoredAt: z.string().datetime({ offset: true }),
});
export type ReadingScore = z.infer<typeof readingScoreSchema>;
