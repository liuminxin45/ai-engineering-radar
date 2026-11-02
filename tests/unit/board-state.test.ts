import { describe, expect, it } from "vitest";
import {
  boardArticles,
  boardCompanies,
  companyArticles,
  boardSearch,
  readBoardQuery,
} from "../../apps/web/src/board.js";
import type { Article } from "../../packages/shared/types.js";
describe("board shareable state", () => {
  it("roundtrips Chinese search, focused company and loaded batches", () => {
    const state = {
      type: "blog" as const,
      q: "模型 + Agent",
      company: "dewu",
      page: 3,
    };
    expect(readBoardQuery(boardSearch(state), ["dewu"])).toEqual(state);
  });
  it("recovers invalid links without hiding all panels or allocating unbounded batches", () => {
    expect(
      readBoardQuery("?company=unknown&sort=wat&page=1.5", ["dewu"]),
    ).toEqual({ type: "blog", q: "", company: "", page: 1 });
    expect(
      boardSearch(readBoardQuery("?sort=oldest&company=dewu", ["dewu"])),
    ).toBe("?company=dewu");
    expect(readBoardQuery("?page=999999", []).page).toBe(1000);
    expect(readBoardQuery("?page=NaN", []).page).toBe(1);
  });
  it("searches all companies while the company parameter only chooses a panel", () => {
    const articles = [
      {
        id: "a",
        companyId: "dewu",
        title: "模型 memory",
        publishedAt: "2026-10-20T00:00:00Z",
        discoveredAt: "2026-11-01T00:00:00Z",
      },
      {
        id: "b",
        companyId: "tencent",
        title: "模型 memory",
        discoveredAt: "2026-10-30T00:00:00Z",
      },
      {
        id: "c",
        companyId: "dewu",
        title: "Other",
        discoveredAt: "2026-10-31T00:00:00Z",
      },
    ] as Article[];
    expect(
      boardArticles(articles, {
        type: "blog",
        q: "MEMORY",
        company: "dewu",
        page: 1,
      }).map((a) => a.id),
    ).toEqual(["b", "a"]);
    expect(
      boardArticles(articles, {
        type: "blog",
        q: "模型",
        company: "dewu",
        page: 1,
      }).map((a) => a.id),
    ).toEqual(["b", "a"]);
  });
  it("keeps known panel order and includes a newly contributed company without mutating the registry", () => {
    const companies = [
      { id: "new-team", name: "新团队", region: "cn" as const },
      { id: "dewu", name: "得物", region: "cn" as const },
    ];
    expect(boardCompanies(companies).map((c) => c.id)).toEqual([
      "dewu",
      "new-team",
    ]);
    expect(companies[0].id).toBe("new-team");
  });
  it("roundtrips paper tabs and falls back to blogs for unknown types", () => {
    const state = {
      type: "paper" as const,
      q: "联合研究",
      company: "tencent",
      page: 2,
    };
    expect(readBoardQuery(boardSearch(state), ["tencent"])).toEqual(state);
    expect(boardSearch(readBoardQuery("?type=unknown", []))).toBe("");
  });
  it("separates legacy blogs and papers and lists a joint paper in each company without multiplying latest", () => {
    const articles = [
      {
        id: "blog",
        companyId: "dewu",
        title: "Joint research",
        discoveredAt: "2026-10-30T00:00:00Z",
      },
      {
        id: "paper",
        contentType: "paper",
        companyId: "dewu",
        companyIds: ["tencent", "meituan"],
        title: "Joint research",
        discoveredAt: "2026-10-31T00:00:00Z",
      },
    ] as Article[];
    const papers = boardArticles(articles, {
      type: "paper",
      q: "RESEARCH",
      company: "",
      page: 1,
    });
    expect(papers.map((a) => a.id)).toEqual(["paper"]);
    expect(companyArticles(papers, "latest")).toHaveLength(1);
    expect(companyArticles(papers, "tencent")).toHaveLength(1);
    expect(companyArticles(papers, "meituan")).toHaveLength(1);
    expect(companyArticles(papers, "dewu")).toHaveLength(0);
    expect(
      boardArticles(articles, {
        type: "blog",
        q: "",
        company: "",
        page: 1,
      }).map((a) => a.id),
    ).toEqual(["blog"]);
  });
});
