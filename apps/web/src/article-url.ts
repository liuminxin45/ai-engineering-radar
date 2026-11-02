import type { Article } from "../../../packages/shared/types";

export const articleHref = (
  article: Pick<Article, "id" | "contentType" | "canonicalUrl">,
) =>
  article.contentType === "paper"
    ? article.canonicalUrl
    : `/articles/${article.id}/`;
