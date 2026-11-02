import type { Article, ContentType } from "../../../packages/shared/types.js";
import type { SearchEngine } from "./site-search.js";
import { articleHref } from "./article-url.ts";

const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase();
const termPattern = (term: string) =>
  term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\d+/g, "(?<!\\d)$&(?!\\d)");
const containsTerm = (text: string, term: string) =>
  text.includes(term) &&
  (!/\d/.test(term) || new RegExp(termPattern(term), "u").test(text));
export const articleSearchTerms = (query: string) => [
  ...new Set(normalize(query).trim().split(/\s+/).filter(Boolean)),
];
export const articleSearchText = (article: Article) =>
  normalize(
    [article.title, article.description, article.author]
      .filter(Boolean)
      .join(" "),
  );
export const matchesArticleSearch = (article: Article, terms: string[]) => {
  const text = articleSearchText(article);
  return terms.every((term) => containsTerm(text, term));
};
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export function searchExcerpt(text: string, terms: string[]) {
  const normalized = normalize(text);
  const first = Math.min(
    ...terms
      .map((term) => normalized.indexOf(term))
      .filter((index) => index >= 0),
  );
  const start = Number.isFinite(first) ? Math.max(0, first - 50) : 0;
  const excerpt = text.slice(start, start + 200);
  const pattern = terms
    .filter(Boolean)
    .map(termPattern)
    .sort((a, b) => b.length - a.length)
    .join("|");
  if (!pattern) return escape(excerpt);
  const expression = new RegExp(pattern, "giu");
  let html = start ? "…" : "";
  let offset = 0;
  for (const match of excerpt.matchAll(expression)) {
    html +=
      escape(excerpt.slice(offset, match.index)) +
      "<mark>" +
      escape(match[0]) +
      "</mark>";
    offset = match.index! + match[0].length;
  }
  return (
    html +
    escape(excerpt.slice(offset)) +
    (start + 200 < text.length ? "…" : "")
  );
}

export function createArticleSearchEngine(
  articles: Article[],
  type: ContentType,
): SearchEngine {
  const index = articles
    .filter((article) => (article.contentType ?? "blog") === type)
    .map((article) => ({
      article,
      title: normalize(article.title),
      text: articleSearchText(article),
    }));
  return {
    init: async () => {},
    search: async (query) => {
      const terms = articleSearchTerms(query);
      const matches = terms.length
        ? index
            .filter((entry) =>
              terms.every((term) => containsTerm(entry.text, term)),
            )
            .sort(
              (a, b) =>
                terms.filter((term) => b.title.includes(term)).length -
                terms.filter((term) => a.title.includes(term)).length,
            )
        : [];
      return {
        results: matches.map(({ article }) => ({
          data: async () => ({
            url: articleHref(article),
            excerpt: searchExcerpt(article.description ?? "", terms),
            meta: {
              title: article.title,
              type: type === "paper" ? "论文" : "博文",
              date: article.publishedAt ?? article.discoveredAt,
              external: type === "paper" ? "true" : "false",
            },
          }),
        })),
      };
    },
  };
}
