import { describe, expect, it } from "vitest";
import {
  boardArticles,
  boardCompanies,
  boardSearch,
  readBoardQuery,
} from "../../apps/web/src/board.js";
import type { Article } from "../../packages/shared/types.js";
describe("board shareable state", () => {
  it("roundtrips Chinese search, focused company and loaded batches", () => {
    const state = {
      q: "模型 + Agent",
      company: "dewu",
      page: 3,
    };
    expect(readBoardQuery(boardSearch(state), ["dewu"])).toEqual(state);
  });
  it("recovers invalid links without hiding all panels or allocating unbounded batches", () => {
    expect(
      readBoardQuery("?company=unknown&sort=wat&page=1.5", ["dewu"]),
    ).toEqual({ q: "", company: "", page: 1 });
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
        q: "MEMORY",
        company: "dewu",
        page: 1,
      }).map((a) => a.id),
    ).toEqual(["b", "a"]);
    expect(
      boardArticles(articles, {
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
});
