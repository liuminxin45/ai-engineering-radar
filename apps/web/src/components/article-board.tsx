"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  IconButton,
  Input,
  InputGroup,
  MagnifyingGlass,
  CloseIcon,
} from "chatgpt-desktop-kit";
import { site } from "../lib";
import { BoardActions } from "./board-actions";
import { BrandMark } from "./brand-mark";
import {
  BOARD_BATCH_SIZE,
  boardArticles,
  boardCompanies,
  boardSearch,
  initialBoardQuery,
  readBoardQuery,
  type BoardQuery,
} from "../board";
import type { Article } from "../../../../packages/shared/types";
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
const day = (value: string) =>
  new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  });
const sourceNames: Record<string, string> = {
  "csdn-feed": "CSDN",
  "cnblogs-account": "博客园",
  "aliyun-group": "阿里云官方博客",
  "volcengine-account": "火山引擎",
  "tencent-news": "腾讯新闻",
};
const sourceName = (a: Article) =>
  sourceNames[
    site.sources.find((s) => s.id === a.locations[0]?.sourceId)?.platform ?? ""
  ] ?? "团队技术博客";
const activeCompanies = new Set(
  site.sources
    .filter((s) => s.crawl.enabled)
    .map((s) => site.publishers.find((p) => p.id === s.publisherId)?.companyId),
);

export function ArticleBoard() {
  const [query, setQuery] = useState<BoardQuery>(initialBoardQuery);
  const queryRef = useRef(query);
  const [pages, setPages] = useState<Record<string, number>>({});
  const pagesRef = useRef(pages);
  const [searching, setSearching] = useState(false);
  const viewport = useRef<HTMLElement>(null);
  const panels = useRef<Record<string, HTMLElement | null>>({});
  const lists = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTops = useRef<Record<string, number>>({});
  const search = useRef<HTMLInputElement>(null);
  const navigation = useRef(false);
  const navigationTarget = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  const active = query.company || "latest";
  const activeIndex = ids.indexOf(active);
  const articles = useMemo(
    () => boardArticles(site.articles, query),
    [query.q],
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
  function loadMore(id: string) {
    const next = (pagesRef.current[id] ?? 1) + 1;
    writePages({ ...pagesRef.current, [id]: next });
    if (id === (queryRef.current.company || "latest"))
      writeQuery({ ...queryRef.current, page: next }, true);
  }
  function scrollList(id: string, list: HTMLDivElement, total: number) {
    const previous = scrollTops.current[id] ?? 0;
    scrollTops.current[id] = list.scrollTop;
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
    const restore = () => {
      const next = readBoardQuery(location.search, companyIds),
        id = next.company || "latest";
      queryRef.current = next;
      writeQuery(next, true);
      writePages({ [id]: next.page });
      scrollTops.current = {};
      for (const list of Object.values(lists.current))
        if (list) list.scrollTop = 0;
      requestAnimationFrame(() => moveTo(id, false));
    };
    restore();
    window.addEventListener("popstate", restore);
    const resized = () => moveTo(queryRef.current.company || "latest", false);
    window.addEventListener("resize", resized);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("resize", resized);
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  useEffect(() => {
    if (searching) search.current?.focus();
  }, [searching]);
  function closeSearch() {
    setSearching(false);
    requestAnimationFrame(() =>
      document.getElementById("mobile-search")?.focus(),
    );
  }

  return (
    <div className={`board-layout ${styles.reader}`}>
      <h1 className={styles.srOnly}>AI Engineering Radar 国内技术文章看板</h1>
      <header
        className={`${styles.toolbar} ${searching ? styles.searching : ""}`}
      >
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
        <div className={styles.searchWrap}>
          <InputGroup>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <Input
              ref={search}
              aria-label="搜索所有面板的文章"
              type="search"
              placeholder="搜索文章、关键词…"
              value={query.q}
              onChange={(event) =>
                changeGlobal({ q: event.target.value }, true)
              }
              onKeyDown={(event) => {
                if (event.key === "Escape" && searching) closeSearch();
              }}
            />
          </InputGroup>
        </div>
        <div className={styles.actions}>
          <div className={styles.mobileSearch}>
            <IconButton
              id="mobile-search"
              aria-label={searching ? "关闭搜索" : "搜索文章"}
              aria-expanded={searching}
              onClick={() => (searching ? closeSearch() : setSearching(true))}
            >
              {searching ? (
                <CloseIcon size={19} />
              ) : (
                <MagnifyingGlass size={20} />
              )}
            </IconButton>
          </div>
          <div className={styles.utilities}>
            <BoardActions />
          </div>
          <span className={styles.sync}>
            <span>更新于</span>
            <time
              dateTime={site.generatedAt}
              title={new Date(site.generatedAt).toLocaleString("zh-CN", {
                timeZone: "Asia/Shanghai",
              })}
            >
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
      <nav className={styles.companyNav} aria-label="定位公司面板">
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
      <main
        id="main"
        className={`board-viewport ${styles.viewport}`}
        ref={viewport}
        tabIndex={0}
        aria-label="横向浏览公司文章面板"
        onWheel={() => {
          navigation.current = false;
        }}
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
          const items =
            id === "latest"
              ? articles
              : articles.filter((a) => a.companyId === id);
          const shown = items.slice(0, (pages[id] ?? 1) * BOARD_BATCH_SIZE),
            name = label(id);
          const latest = site.articles.find(
            (a) => id === "latest" || a.companyId === id,
          );
          return (
            <section
              id={`panel-${id}`}
              key={id}
              ref={(el) => {
                panels.current[id] = el;
              }}
              className={`${styles.panel} ${id === "latest" ? styles.latest : ""}`}
              aria-label={`${name}文章面板`}
            >
              <div className={styles.panelHead}>
                <div>
                  <h2>{id === "latest" ? "最新文章" : name}</h2>
                  <p>
                    {id === "latest"
                      ? "所有公司的最新发布"
                      : activeCompanies.has(id)
                        ? `最新 ${latest ? day(time(latest)) : "—"}`
                        : "历史收录 · 暂停新增"}
                  </p>
                </div>
              </div>
              <div
                ref={(el) => {
                  lists.current[id] = el;
                }}
                className={styles.panelList}
                role="region"
                aria-label={`${name}文章列表`}
                tabIndex={0}
                onScroll={(event) =>
                  scrollList(id, event.currentTarget, items.length)
                }
              >
                {shown.map((a) => (
                  <article className={`board-story ${styles.story}`} key={a.id}>
                    <h3>
                      <a
                        href={a.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="link-label">{a.title}</span>
                      </a>
                    </h3>
                    <div className={styles.storyMeta}>
                      <div>
                        <span>
                          {id === "latest" ? label(a.companyId) : sourceName(a)}
                        </span>
                        <time dateTime={time(a)}>
                          {!a.publishedAt && "发现 "}
                          {day(time(a))}
                        </time>
                      </div>
                      {a.advertorial?.status === "suspected" && (
                        <Link
                          className={styles.advertorialBadge}
                          data-no-underline
                          href={`/articles/${a.id}/#advertorial-review`}
                          prefetch={false}
                          aria-label="疑似软文：查看标记依据"
                        >
                          疑似软文
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
                {!items.length && (
                  <div className={styles.empty}>
                    <h3>没有匹配的文章</h3>
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
  );
}
