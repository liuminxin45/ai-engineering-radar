import type { Article, ContentType } from "./types.js";

export const articleContentType = (
  a: Pick<Article, "contentType">,
): ContentType => a.contentType ?? "blog";

export const articleCompanyIds = (
  a: Pick<Article, "contentType" | "companyId" | "companyIds">,
): string[] =>
  a.contentType === "paper" ? (a.companyIds ?? [a.companyId]) : [a.companyId];
