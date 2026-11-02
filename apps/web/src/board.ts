import type { Article, Company } from "../../../packages/shared/types.js";

export const BOARD_BATCH_SIZE = 20;
export type BoardQuery = {
  q: string;
  company: string;
  page: number;
};
export const initialBoardQuery: BoardQuery = {
  q: "",
  company: "",
  page: 1,
};
const order = [
  "dewu",
  "alibaba",
  "qwen",
  "tencent",
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
  "oppo",
  "ctrip",
  "xiaohongshu",
  "xiaomi",
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
  const q = query.q.trim().toLocaleLowerCase();
  return articles
    .filter(
      (a) =>
        !q ||
        `${a.title} ${a.description ?? ""} ${a.author ?? ""}`
          .toLocaleLowerCase()
          .includes(q),
    )
    .sort((a, b) => {
      return (
        (b.publishedAt ?? b.discoveredAt).localeCompare(
          a.publishedAt ?? a.discoveredAt,
        ) || b.id.localeCompare(a.id)
      );
    });
}
