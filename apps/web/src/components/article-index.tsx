"use client";
import { useEffect, useMemo, useState } from "react";
import { site, asset } from "../lib";
import { ArticleRow } from "./article-row";
type Filter = {
  q: string;
  company: string;
  topic: string;
  sort: string;
  page: number;
};
const initial: Filter = {
  q: "",
  company: "",
  topic: "",
  sort: "newest",
  page: 1,
};
function readQuery(): Filter {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get("q") ?? "",
    company: p.get("company") ?? "",
    topic: p.get("topic") ?? "",
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
    if (next.topic) p.set("topic", next.topic);
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
          (!filter.topic ||
            a.classification.topics.includes(filter.topic as never)) &&
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
  const selected = !!(
    filter.q ||
    filter.company ||
    filter.topic ||
    filter.sort !== "newest"
  );
  const feed = filter.topic
    ? `/feed/topic/${filter.topic}`
    : filter.company
      ? `/feed/company/${filter.company}`
      : "/feed";
  return (
    <section aria-label="文章索引">
      <div className="filters">
        <div className="search-field">
          <label htmlFor="search">搜索文章</label>
          <input
            id="search"
            type="search"
            value={filter.q}
            placeholder="搜索标题、摘要或作者…"
            onChange={(e) => update({ q: e.target.value }, true)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="company">公司</label>
          <select
            id="company"
            value={filter.company}
            onChange={(e) => update({ company: e.target.value })}
          >
            <option value="">全部公司</option>
            {site.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="topic">主题</label>
          <select
            id="topic"
            value={filter.topic}
            onChange={(e) => update({ topic: e.target.value })}
          >
            <option value="">全部主题</option>
            {site.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field sort-field">
          <label htmlFor="sort">排序</label>
          <select
            id="sort"
            value={filter.sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
        </div>
      </div>
      <div className="result-bar">
        <p aria-live="polite">
          <strong>{results.length}</strong> 篇工程实践{" "}
          <span className="muted">· 按发布或发现日期</span>
        </p>
        <div className="result-actions">
          {selected && (
            <button className="text-button" onClick={() => update(initial)}>
              清空筛选
            </button>
          )}
          <a href={asset(`${feed}.xml`)}>RSS</a>
          <a href={asset(`${feed}.atom`)}>Atom</a>
        </div>
      </div>
      {filter.company && filter.topic && (
        <p className="small muted">
          订阅入口按当前主题提供；公司与主题组合筛选仅用于页面浏览。
        </p>
      )}
      <div className="article-list">
        {displayed.map((a) => (
          <ArticleRow key={a.id} article={a} />
        ))}
      </div>
      {!results.length && (
        <div className="empty">
          <h2>暂时没有匹配的文章</h2>
          <p>试试其他关键词，或清空筛选查看全部工程实践。</p>
          {selected && (
            <button onClick={() => update(initial)}>查看全部文章</button>
          )}
        </div>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="文章分页">
          <button
            disabled={page === 1}
            onClick={() => {
              update({ page: page - 1 });
              document.getElementById("search")?.focus();
            }}
          >
            上一页
          </button>
          <span>
            第 {page} / {pages} 页
          </span>
          <button
            disabled={page === pages}
            onClick={() => {
              update({ page: page + 1 });
              document.getElementById("search")?.focus();
            }}
          >
            下一页
          </button>
        </nav>
      )}
    </section>
  );
}
