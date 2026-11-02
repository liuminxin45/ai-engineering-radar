import { z } from "zod";

// Rules are data. They never contain JavaScript, callbacks, or network requests.
export const parserRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string(),
    hosts: z.array(z.string()).min(1),
    pathPattern: z.string().optional(),
    title: z.array(z.string()).default([]),
    include: z.array(z.string()).min(1),
    exclude: z.array(z.string()).default([]),
    minTextLength: z.number().int().positive().default(120),
    reference: z.string().url().optional(),
  })
  .strict();

export type ParserRule = z.infer<typeof parserRuleSchema>;
export type Heading = { id: string; level: number; text: string };
export type ParsedArticle = {
  status: "ready" | "partial";
  title: string;
  html: string;
  headings: Heading[];
  textLength: number;
  readingMinutes: number;
  ruleId: string;
  ruleVersion: string;
  warnings: string[];
  sourceUrl: string;
};
export type ParseInput = {
  url: string;
  content: string;
  title?: string;
  format?: "html" | "markdown" | "markdown-tokens";
  // Only complete publisher feed/API fields may be parsed as a fragment.
  fragment?: boolean;
  ruleId?: string;
  ruleVersion?: string;
};
