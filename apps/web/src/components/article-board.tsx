"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { site, asset } from "../lib";
import { BoardActions } from "./board-actions";
import { Button } from "./action-button";
import SearchLauncher from "./search-launcher";
import { BrandMark } from "./brand-mark";
import { useBoardWheel } from "./use-board-wheel";
import { articleHref } from "../article-url";
import { ArticleLink } from "./article-link";
import {
  BOARD_BATCH_SIZE,
  boardArticles,
  boardCompanies,
  companyArticles,
  boardSearch,
  initialBoardQuery,
  readBoardQuery,
  type BoardQuery,
} from "../board";
import type { Article } from "../../../../packages/shared/types";
import { articleCompanyIds } from "../../../../packages/shared/content.ts";
import styles from "./article-board.module.css";

const companies = boardCompanies(site.companies);
const ids = ["latest", ...companies.map((c) => c.id)];
const companyIds = companies.map((c) => c.id);
const labels: Record<string, string> = {
  latest: "最新",
  alibaba: "阿里云",
  bytedance: "字节跳动",
  bilibili: "哔哩哔哩",
};
const label = (id: string) =>
  labels[id] ?? companies.find((c) => c.id === id)?.name ?? id;
const time = (a: Article) => a.publishedAt ?? a.discoveredAt;
const calendar = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});
const day = (value: string) => calendar.format(new Date(value));
const contentTypes = [
  { id: "blog", name: "博文" },
  { id: "paper", name: "论文" },
] as const;

export function ArticleBoard() {
  const [query, setQuery] = useState<BoardQuery>(initialBoardQuery);
  const queryRef = useRef(query);
  const [pages, setPages] = useState<Record<string, number>>({});
  const pagesRef = useRef(pages);
  const viewport = useRef<HTMLElement>(null);
  const companyNav = useRef<HTMLElement>(null);
  const panels = useRef<Record<string, HTMLElement | null>>({});
  const lists = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTops = useRef<Record<string, number>>({});
  const navigation = useRef(false);
  const navigationTarget = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  useBoardWheel(viewport, companyNav, navigation);
  const restoring = useRef(false);
  const active = query.company || "latest";
  const contentName = query.type === "paper" ? "论文" : "文章";
  const activeIndex = ids.indexOf(active);
  const articles = useMemo(
    () => boardArticles(site.articles, query),
    [query.q, query.type],
  );

  function writeQuery(next: BoardQuery, replace = false) {
    queryRef.current = next;
    setQuery(next);
    const url = `${location.pathname}${boardSearch(next)}`;
    if (url !== `${location.pathname}${location.search}`)
      window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }
  function writePages(next: Record<string, number>) {
    pagesRef.current = next;
    setPages(next);
  }
  function moveTo(id: string, smooth = true) {
    const board = viewport.current,
      panel = panels.current[id],
      first = panels.current.latest;
    if (!board || !panel || !first) return;
    navigation.current = true;
    navigationTarget.current = Math.max(
      0,
      Math.min(
        panel.offsetLeft - first.offsetLeft,
        board.scrollWidth - board.clientWidth,
      ),
    );
    board.scrollTo({
      left: navigationTarget.current,
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
    if (Math.abs(board.scrollLeft - navigationTarget.current) <= 2)
      navigation.current = false;
    document
      .getElementById(`company-${id}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function locate(id: string) {
    writeQuery({
      ...queryRef.current,
      company: id === "latest" ? "" : id,
      page: pagesRef.current[id] ?? 1,
    });
    moveTo(id);
  }
  function changeGlobal(patch: Partial<BoardQuery>, replace = false) {
    scrollTops.current = {};
    writePages({});
    writeQuery({ ...queryRef.current, ...patch, page: 1 }, replace);
    for (const list of Object.values(lists.current))
      if (list) list.scrollTop = 0;
  }
  function switchType(type: BoardQuery["type"]) {
    if (type !== queryRef.current.type) changeGlobal({ type });
  }
  function loadMore(id: string) {
    const next = (pagesRef.current[id] ?? 1) + 1;
    writePages({ ...pagesRef.current, [id]: next });
    if (id === (queryRef.current.company || "latest"))
      writeQuery({ ...queryRef.current, page: next }, true);
  }
  function scrollList(id: string, list: HTMLDivElement, total: number) {
    const previous = scrollTops.current[id] ?? 0;
    scrollTops.current[id] = list.scrollTop;
    if (restoring.current) return;
    // Load once on approaching the bottom; appending keeps the reading position.
    // Another batch requires scrolling down through the newly appended articles.
    if (
      list.scrollTop > previous &&
      list.scrollHeight - list.scrollTop - list.clientHeight <= 32 &&
      (pagesRef.current[id] ?? 1) * BOARD_BATCH_SIZE < total
    )
      loadMore(id);
  }
  function handleScroll() {
    if (navigation.current) {
      if (
        viewport.current &&
        Math.abs(viewport.current.scrollLeft - navigationTarget.current) <= 2
      )
        navigation.current = false;
      return;
    }
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (navigation.current) return;
      const board = viewport.current,
        first = panels.current.latest,
        second = panels.current[ids[1]];
      if (!board || !first || !second) return;
      const step = second.offsetLeft - first.offsetLeft;
      if (step <= 0) return;
      const selected = panels.current[queryRef.current.company || "latest"];
      if (selected) {
        // The final desktop columns share the same clamped scroll position.
        // Keep the explicitly focused column when it cannot align to the left.
        const destination = Math.min(
          selected.offsetLeft - first.offsetLeft,
          board.scrollWidth - board.clientWidth,
        );
        if (Math.abs(board.scrollLeft - destination) <= 2) return;
      }
      const id =
        ids[
          Math.min(
            ids.length - 1,
            Math.max(0, Math.round(board.scrollLeft / step)),
          )
        ];
      if (id === (queryRef.current.company || "latest")) return;
      writeQuery(
        {
          ...queryRef.current,
          company: id === "latest" ? "" : id,
          page: pagesRef.current[id] ?? 1,
        },
        true,
      );
      document
        .getElementById(`company-${id}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  useEffect(() => {
    const save = () => {
      if (location.pathname !== asset("/")) return;
      const positions = Object.fromEntries(
        Object.entries(lists.current).map(([id, list]) => [
          id,
          list?.scrollTop || 0,
        ]),
      );
      history.replaceState(
        {
          ...history.state,
          radarBoard: {
            url: location.pathname + location.search,
            pages: pagesRef.current,
            positions,
            left: viewport.current?.scrollLeft || 0,
          },
        },
        "",
      );
    };
    const restore = () => {
      try {
        sessionStorage.removeItem("radar:reader-origin");
      } catch {}
      const next = readBoardQuery(location.search, companyIds),
        id = next.company || "latest";
      queryRef.current = next;
      writeQuery(next, true);
      const saved = history.state?.radarBoard;
      const matching = saved?.url === location.pathname + location.search;
      writePages(
        matching ? { ...saved.pages, [id]: next.page } : { [id]: next.page },
      );
      scrollTops.current = matching ? { ...saved.positions } : {};
      restoring.current = true;
      for (const list of Object.values(lists.current))
        if (list) list.scrollTop = 0;
      requestAnimationFrame(() => {
        moveTo(id, false);
        if (matching) {
          for (const [key, list] of Object.entries(lists.current))
            if (list) list.scrollTop = saved.positions[key] || 0;
          if (viewport.current) {
            viewport.current.scrollLeft = saved.left;
            navigationTarget.current = saved.left;
          }
        }
        requestAnimationFrame(() => {
          restoring.current = false;
        });
      });
    };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("radar:save-board", save);
    window.addEventListener("pagehide", save);
    const resized = () => moveTo(queryRef.current.company || "latest", false);
    window.addEventListener("resize", resized);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("radar:save-board", save);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("resize", resized);
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  return (
    <div className={`board-layout ${styles.reader}`}>
      <h1 className={styles.srOnly}>
        AI Engineering Radar 国内技术{contentName}看板
      </h1>
      <header className={styles.toolbar}>
        <Link
          className={`brand ${styles.brand}`}
          prefetch={false}
          href="/"
          aria-label="AI Engineering Radar 首页"
          onClick={(event) => {
            if (
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            changeGlobal(initialBoardQuery);
            moveTo("latest");
          }}
        >
          <BrandMark className={styles.logo} />
          <span className={styles.desktopBrand}>
            AI Engineering <strong>Radar</strong>
          </span>
          <span className={styles.mobileBrand}>Radar</span>
        </Link>
        <div className={styles.typeTabs} role="tablist" aria-label="内容类型">
          {contentTypes.map(({ id, name }, index) => (
            <Button
              key={id}
              id={`content-${id}`}
              variant="ghost"
              role="tab"
              aria-selected={query.type === id}
              aria-controls="content-board"
              tabIndex={query.type === id ? 0 : -1}
              className={styles.typeTab}
              onClick={() => switchType(id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowRight")
                  next = (index + 1) % contentTypes.length;
                else if (event.key === "ArrowLeft")
                  next =
                    (index + contentTypes.length - 1) % contentTypes.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = contentTypes.length - 1;
                else return;
                event.preventDefault();
                switchType(contentTypes[next].id);
                document
                  .getElementById(`content-${contentTypes[next].id}`)
                  ?.focus();
              }}
            >
              <span className="link-label">{name}</span>
            </Button>
          ))}
        </div>
        <div className={styles.actions}>
          <div className={styles.utilities}>
            <SearchLauncher
              query={query.q}
              type={query.type}
              onQueryChange={(q) => changeGlobal({ q }, true)}
            />
            <BoardActions />
          </div>
          <span className={styles.sync}>
            <span>更新于</span>
            <time dateTime={site.generatedAt}>
              <span className={styles.fullTime}>
                {new Date(site.generatedAt).toLocaleString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Shanghai",
                })}
              </span>
              <span className={styles.shortTime}>
                {new Date(site.generatedAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Shanghai",
                })}
              </span>
            </time>
          </span>
        </div>
      </header>
      <nav
        ref={companyNav}
        className={styles.companyNav}
        aria-label="定位公司面板"
      >
        {ids.map((id) => (
          <Button
            id={`company-${id}`}
            key={id}
            variant="ghost"
            className={`${styles.companyTab} ${active === id ? styles.current : ""}`}
            aria-label={label(id)}
            aria-current={active === id ? "location" : undefined}
            aria-controls={`panel-${id}`}
            onClick={() => locate(id)}
          >
            <span className="link-label">{label(id)}</span>
          </Button>
        ))}
      </nav>
      <div
        id="content-board"
        role="tabpanel"
        aria-labelledby={`content-${query.type}`}
        className={styles.contentBoard}
      >
        <main
          id="main"
          className={`board-viewport ${styles.viewport}`}
          ref={viewport}
          tabIndex={0}
          aria-label={`横向浏览公司${contentName}面板`}
          onTouchStart={() => {
            navigation.current = false;
          }}
          onPointerDown={() => {
            navigation.current = false;
          }}
          onScroll={(event) => {
            if (event.target === event.currentTarget) handleScroll();
          }}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              ["ArrowLeft", "ArrowRight"].includes(event.key)
            ) {
              event.preventDefault();
              locate(
                ids[
                  Math.min(
                    ids.length - 1,
                    Math.max(
                      0,
                      activeIndex + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  )
                ],
              );
            }
          }}
        >
          {ids.map((id) => {
            const items = companyArticles(articles, id);
            const shown = items.slice(0, (pages[id] ?? 1) * BOARD_BATCH_SIZE),
              name = label(id);
            return (
              <section
                id={`panel-${id}`}
                key={id}
                ref={(el) => {
                  panels.current[id] = el;
                }}
                className={`${styles.panel} ${id === "latest" ? styles.latest : ""}`}
                aria-label={`${name}${contentName}面板`}
              >
                <div className={styles.panelHead}>
                  <h2>{id === "latest" ? `最新${contentName}` : name}</h2>
                </div>
                <div
                  ref={(el) => {
                    lists.current[id] = el;
                  }}
                  className={styles.panelList}
                  data-board-list
                  role="region"
                  aria-label={`${name}${contentName}列表`}
                  tabIndex={0}
                  onScroll={(event) =>
                    scrollList(id, event.currentTarget, items.length)
                  }
                >
                  {shown.map((a) => (
                    <article
                      className={`board-story ${styles.story}`}
                      key={a.id}
                    >
                      <h3>
                        <ArticleLink href={articleHref(a)}>
                          <span className="link-label">{a.title}</span>
                        </ArticleLink>
                      </h3>
                      <div className={styles.storyMeta}>
                        <time
                          dateTime={time(a)}
                          aria-label={`${a.publishedAt ? "发布时间" : "发现时间"} ${day(time(a))}`}
                        >
                          {day(time(a))}
                        </time>
                        {a.advertorial?.status === "suspected" ? (
                          <Link
                            className={styles.advertorialBadge}
                            data-no-underline
                            href={`/articles/${a.id}/#advertorial-review`}
                            prefetch={false}
                            aria-label="疑似软文：查看标记依据"
                          >
                            疑似软文
                          </Link>
                        ) : a.contentType !== "paper" && a.readingScore ? (
                          <span
                            className={styles.readingScoreBadge}
                            data-reading-score
                            role="meter"
                            aria-label={`${a.readingScore.displayName} 标题工程相关性评分`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={a.readingScore.score}
                          >
                            {a.readingScore.displayName} {a.readingScore.score}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {!items.length && (
                    <div className={styles.empty}>
                      <h3>
                        {query.q
                          ? `没有匹配的${contentName}`
                          : `暂时没有${contentName}`}
                      </h3>
                      {query.q && (
                        <Button
                          variant="ghost"
                          onClick={() => changeGlobal({ q: "" })}
                        >
                          清空搜索
                        </Button>
                      )}
                    </div>
                  )}
                  {!!items.length && shown.length === items.length && (
                    <p className={styles.end}>已显示全部</p>
                  )}
                </div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
