"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Input, Select } from "chatgpt-desktop-kit";
import { site, asset } from "../lib";
import { ArticleRow } from "./article-row";
type Filter = {
  q: string;
  company: string;
  sort: string;
  page: number;
};
const initial: Filter = {
  q: "",
  company: "",
  sort: "newest",
  page: 1,
};
function readQuery(): Filter {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") ?? "",
    company: p.get("company") ?? "",
    sort: p.get("sort") === "oldest" ? "oldest" : "newest",
    page: Math.max(1, Number(p.get("page")) || 1),
  };
}
export function ArticleIndex() {
  const [filter, setFilter] = useState<Filter>(initial);
  useEffect(() => {
    const sync = () => setFilter(readQuery());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function update(patch: Partial<Filter>, replace = false) {
    const next = { ...filter, ...patch };
    if (!("page" in patch)) next.page = 1;
    setFilter(next);
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.company) p.set("company", next.company);
    if (next.sort !== "newest") p.set("sort", next.sort);
    if (next.page > 1) p.set("page", String(next.page));
    const url = `${location.pathname}${p.size ? "?" + p : ""}`;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }
  const results = useMemo(() => {
    const q = filter.q.trim().toLocaleLowerCase();
    return site.articles
      .filter(
        (a) =>
          (!filter.company || a.companyId === filter.company) &&
          (!q ||
            `${a.title} ${a.description ?? ""} ${a.author ?? ""}`
              .toLocaleLowerCase()
              .includes(q)),
      )
      .sort((a, b) => {
        const cmp =
          (b.publishedAt ?? b.discoveredAt).localeCompare(
            a.publishedAt ?? a.discoveredAt,
          ) || b.id.localeCompare(a.id);
        return filter.sort === "oldest" ? -cmp : cmp;
      });
  }, [filter]);
  const pages = Math.max(1, Math.ceil(results.length / 20)),
    page = Math.min(filter.page, pages);
  const displayed = results.slice((page - 1) * 20, page * 20);
  const selected = !!(filter.q || filter.company || filter.sort !== "newest");
  const feed = filter.company ? `/feed/company/${filter.company}` : "/feed";
  return (
    <section aria-label="文章索引">
      <div className="filters">
        <div className="search-field">
          <label htmlFor="search">搜索文章</label>
          <Input
            id="search"
            type="search"
            value={filter.q}
            placeholder="搜索标题、摘要或作者…"
            onChange={(e) => update({ q: e.target.value }, true)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="company">公司</label>
          <Select
            id="company"
            value={filter.company}
            onValueChange={(company) => update({ company })}
            options={[
              { value: "", label: "全部公司" },
              ...site.companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="filter-field sort-field">
          <label htmlFor="sort">排序</label>
          <Select
            id="sort"
            value={filter.sort}
            onValueChange={(sort) => update({ sort })}
            options={[
              { value: "newest", label: "最新优先" },
              { value: "oldest", label: "最早优先" },
            ]}
          />
        </div>
      </div>
      <div className="result-bar">
        <p aria-live="polite">
          <strong>{results.length}</strong> 篇文章
        </p>
        <div className="result-actions">
          {selected && (
            <Button variant="ghost" size="sm" onClick={() => update(initial)}>
              清空筛选
            </Button>
          )}
          <a href={asset(`${feed}.xml`)}>RSS</a>
          <a href={asset(`${feed}.atom`)}>Atom</a>
        </div>
      </div>
      <div className="article-list">
        {displayed.map((a) => (
          <ArticleRow key={a.id} article={a} />
        ))}
      </div>
      {!results.length && (
        <div className="empty">
          <h2>暂时没有匹配的文章</h2>
          <p>试试其他关键词，或清空筛选查看全部文章。</p>
          {selected && (
            <Button onClick={() => update(initial)}>查看全部文章</Button>
          )}
        </div>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="文章分页">
          <Button
            disabled={page === 1}
            onClick={() => {
              update({ page: page - 1 });
              document.getElementById("search")?.focus();
            }}
          >
            上一页
          </Button>
          <span>
            第 {page} / {pages} 页
          </span>
          <Button
            disabled={page === pages}
            onClick={() => {
              update({ page: page + 1 });
              document.getElementById("search")?.focus();
            }}
          >
            下一页
          </Button>
        </nav>
      )}
    </section>
  );
}
