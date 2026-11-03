import type {
  Article,
  Company,
  ContentType,
} from "../../../packages/shared/types.js";
import { articleSearchTerms, matchesArticleSearch } from "./article-search.ts";
import {
  articleCompanyIds,
  articleContentType,
} from "../../../packages/shared/content.ts";

export const BOARD_BATCH_SIZE = 20;
export type BoardQuery = {
  type: ContentType;
  q: string;
  company: string;
  page: number;
};
export const initialBoardQuery: BoardQuery = {
  type: "blog",
  q: "",
  company: "",
  page: 1,
};
const order = [
  "tencent",
  "dewu",
  "alibaba",
  "qwen",
  "bytedance",
  "meituan",
  "vivo",
  "huawei",
  "kuaishou",
  "netease",
  "bilibili",
  "jd",
  "baidu",
  "ant",
];
export function boardCompanies(companies: Company[]) {
  return [...companies].sort((a, b) => {
    const rank = (id: string) =>
      order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "zh-CN");
  });
}
export function readBoardQuery(
  search: string,
  companies: string[],
): BoardQuery {
  const p = new URLSearchParams(search),
    company = p.get("company") ?? "";
  const page = Number(p.get("page"));
  return {
    type: "blog",
    q: p.get("q") ?? "",
    company: companies.includes(company) ? company : "",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}
export function boardSearch(query: BoardQuery) {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.company) p.set("company", query.company);
  if (query.page > 1) p.set("page", String(query.page));
  return p.size ? `?${p}` : "";
}
export function boardArticles(articles: Article[], query: BoardQuery) {
  const terms = articleSearchTerms(query.q);
  return articles
    .filter(
      (a) => articleContentType(a) === "blog" && matchesArticleSearch(a, terms),
    )
    .sort((a, b) => {
      return (
        (b.publishedAt ?? b.discoveredAt).localeCompare(
          a.publishedAt ?? a.discoveredAt,
        ) || b.id.localeCompare(a.id)
      );
    });
}
export function companyArticles(articles: Article[], company: string) {
  return company === "latest"
    ? articles
    : articles.filter((a) => articleCompanyIds(a).includes(company));
}
