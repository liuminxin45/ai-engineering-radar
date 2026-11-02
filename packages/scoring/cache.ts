import { createHash } from "node:crypto";
import type { Article } from "../shared/types.js";
import { READING_RUBRIC } from "./rubric.js";

export const titleHash = (title: string) =>
  createHash("sha256").update(title).digest("hex");

export function hasCurrentReadingScore(article: Article) {
  const score = article.readingScore;
  return (
    !!score &&
    score.titleHash === titleHash(article.title) &&
    score.rubricVersion === READING_RUBRIC.version
  );
}

/** Also used by export, so changes made without running the scoring command stay safe. */
export function clearInvalidReadingScore(article: Article) {
  if (
    article.contentType === "paper" ||
    article.advertorial?.status === "suspected" ||
    !hasCurrentReadingScore(article)
  )
    delete article.readingScore;
}
