"use client";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Search, SearchX, LoaderCircle } from "./search-icons";
import { SearchSession } from "../site-search";
import { ArticleLink } from "./article-link";
const formatBlogDate = (date: string) =>
  new Date(date).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });

export type SearchResultState = {
  ready: boolean;
  activeIndex: number;
  count: number;
  message: string;
};

// Reuse the reference renderer: excerpts allow text and <mark>, never HTML.
function Excerpt({ html }: { html: string }) {
  const document = new DOMParser().parseFromString(html, "text/html");
  function text(node: ChildNode, key: number): React.ReactNode {
    if (node.nodeType === 3) return node.textContent;
    if (!(node instanceof Element)) return null;
    const children = Array.from(node.childNodes).map(text);
    return node.tagName === "MARK" ? (
      <mark key={key}>{children}</mark>
    ) : (
      <Fragment key={key}>{children}</Fragment>
    );
  }
  return <>{Array.from(document.body.childNodes).map(text)}</>;
}

export default function SearchResults({
  query,
  type,
  onClose,
  controlsRef,
  onState,
}: {
  query: string;
  type: "blog" | "paper";
  onClose: () => void;
  controlsRef: RefObject<SearchSession | null>;
  onState: (state: SearchResultState) => void;
}) {
  const [session] = useState(
    () =>
      new SearchSession(async () => {
        const { createArticleSearchEngine } = await import("../article-search");
        const { site } = await import("../lib");
        return createArticleSearchEngine(site.articles, type);
      }),
  );
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { results, loading, error, visibleCount, activeIndex } = snapshot;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    controlsRef.current = session;
    void session.initialize();
    return () => {
      controlsRef.current = null;
      session.dispose();
    };
  }, [session, controlsRef]);
  // Preserve text entered before this module or the index finishes loading.
  useEffect(() => {
    if (session.getSnapshot().query !== query) session.setQuery(query);
  }, [query, session]);
  useLayoutEffect(() => {
    onState({
      ready: true,
      activeIndex,
      count: Math.min(results.length, visibleCount),
      message:
        query.trim() && !loading && !error
          ? `显示 ${Math.min(results.length, visibleCount)} / ${results.length} 条结果`
          : "",
    });
  }, [
    activeIndex,
    results.length,
    visibleCount,
    query,
    loading,
    error,
    onState,
  ]);
  useEffect(() => {
    if (activeIndex >= 0)
      container.current
        ?.querySelector(`#search-result-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  const displayed = results.slice(0, visibleCount);
  return (
    <div className="site-search-results" ref={container} aria-busy={loading}>
      {loading ? (
        <div className="site-search-state" role="status">
          <LoaderCircle
            size={22}
            className="search-spinner"
            aria-hidden="true"
          />
          <span className="sr-only">正在搜索</span>
        </div>
      ) : error ? (
        <div className="site-search-state" role="alert">
          <p>搜索暂时不可用，请重试。</p>
          <button
            type="button"
            className="search-retry"
            onClick={() => session.retry()}
          >
            重试
          </button>
        </div>
      ) : !query.trim() ? (
        <div className="site-search-state">
          <Search size={40} strokeWidth={1.25} aria-hidden="true" />
          <p>输入关键词搜索{type === "paper" ? "论文" : "文章"}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="site-search-state">
          <SearchX size={44} strokeWidth={1.25} aria-hidden="true" />
          <p>没有找到与“{query}”匹配的内容</p>
        </div>
      ) : null}
      <ul id="site-search-results" role="listbox" aria-label="搜索结果">
        {displayed.map((result, index) => {
          const content = (
            <>
              <span className="search-result-heading">{result.title}</span>
              <span className="search-result-meta">
                {result.type}
                {result.date && <> · {formatBlogDate(result.date)}</>}
              </span>
              {result.excerpt && (
                <span className="search-result-excerpt">
                  <Excerpt html={result.excerpt} />
                </span>
              )}
            </>
          );
          return (
            <li
              key={result.url}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <ArticleLink href={result.url} onClick={onClose}>
                {content}
              </ArticleLink>
            </li>
          );
        })}
      </ul>
      {!loading && results.length > visibleCount && (
        <div className="site-search-more">
          <button type="button" onClick={() => session.loadMore()}>
            加载更多（剩余 {results.length - visibleCount} 条）
          </button>
        </div>
      )}
    </div>
  );
}
