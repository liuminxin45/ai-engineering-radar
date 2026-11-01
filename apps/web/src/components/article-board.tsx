"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  IconButton,
  Input,
  InputGroup,
  MenuButton,
  MagnifyingGlass,
  ArrowLeft,
  ArrowRight,
  DotsThree,
  CloseIcon,
  CheckIcon,
  useDesktopTheme,
} from "chatgpt-desktop-kit";
import { site, asset } from "../lib";
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
  const router = useRouter();
  const { theme, setTheme } = useDesktopTheme();
  const [query, setQuery] = useState<BoardQuery>(initialBoardQuery);
  const queryRef = useRef(query);
  const [pages, setPages] = useState<Record<string, number>>({});
  const pagesRef = useRef(pages);
  const [searching, setSearching] = useState(false);
  const viewport = useRef<HTMLElement>(null);
  const panels = useRef<Record<string, HTMLElement | null>>({});
  const lists = useRef<Record<string, HTMLDivElement | null>>({});
  const search = useRef<HTMLInputElement>(null);
  const navigation = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const active = query.company || "latest";
  const activeIndex = ids.indexOf(active);
  const articles = useMemo(
    () => boardArticles(site.articles, query),
    [query.q, query.sort],
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
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      navigation.current = false;
    }, 500);
    board.scrollTo({
      left: panel.offsetLeft - first.offsetLeft,
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
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
    writePages({});
    writeQuery({ ...queryRef.current, ...patch, page: 1 }, replace);
    for (const list of Object.values(lists.current))
      if (list) list.scrollTop = 0;
  }
  function loadMore(id: string) {
    const next = (pagesRef.current[id] ?? 1) + 1;
    writePages({ ...pagesRef.current, [id]: next });
    writeQuery({
      ...queryRef.current,
      company: id === "latest" ? "" : id,
      page: next,
    });
  }
  function handleScroll() {
    if (navigation.current || scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (navigation.current) return;
      const board = viewport.current,
        first = panels.current.latest,
        second = panels.current[ids[1]];
      if (!board || !first || !second) return;
      const step = second.offsetLeft - first.offsetLeft;
      if (step <= 0) return;
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
      setQuery(next);
      writePages({ [id]: next.page });
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
      if (navTimer.current) clearTimeout(navTimer.current);
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
  function feed(id: string, atom = false) {
    return asset(
      `/feed${id === "latest" ? "" : `/company/${id}`}.${atom ? "atom" : "xml"}`,
    );
  }
  function openFeed(id: string, atom = false) {
    window.open(feed(id, atom), "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`board-layout ${styles.reader}`}>
      <h1 className={styles.srOnly}>AI Engineering Radar 国内技术文章看板</h1>
      <header
        className={`${styles.toolbar} ${searching ? styles.searching : ""}`}
      >
        <Link
          className={styles.brand}
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
          <span className={styles.logo} aria-hidden="true" />
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
            <span className={styles.searchScope}>所有公司</span>
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
          <Link className={styles.sources} prefetch={false} href="/sources/">
            来源 <span>{site.sources.length}</span>
          </Link>
          <a
            className={styles.rss}
            href={feed("latest")}
            aria-label="全站 RSS 订阅"
          >
            RSS
          </a>
          <div className={styles.globalMenu}>
            <MenuButton
              actionId="board-options"
              label="更多选项"
              icon={<DotsThree size={23} />}
              iconOnly
              items={[
                {
                  label: "最新优先",
                  icon:
                    query.sort === "newest" ? (
                      <CheckIcon size={16} />
                    ) : undefined,
                  actionId: "sort-newest",
                  onSelect: () => changeGlobal({ sort: "newest" }),
                },
                {
                  label: "最早优先",
                  icon:
                    query.sort === "oldest" ? (
                      <CheckIcon size={16} />
                    ) : undefined,
                  actionId: "sort-oldest",
                  onSelect: () => changeGlobal({ sort: "oldest" }),
                },
                {
                  label: "清空搜索与排序",
                  actionId: "clear",
                  disabled: !query.q && query.sort === "newest",
                  onSelect: () => changeGlobal({ q: "", sort: "newest" }),
                },
                {
                  label: "来源目录",
                  actionId: "sources",
                  onSelect: () => router.push("/sources/"),
                },
                {
                  label: "关于项目",
                  actionId: "about",
                  onSelect: () => router.push("/about/"),
                },
                {
                  label: "全站 Atom 订阅",
                  actionId: "atom",
                  onSelect: () => openFeed("latest", true),
                },
                {
                  label: "GitHub / 贡献来源",
                  actionId: "github",
                  onSelect: () =>
                    window.open(
                      "https://github.com/liuminxin45/ai-engineering-radar",
                      "_blank",
                      "noopener,noreferrer",
                    ),
                },
                ...(["system", "light", "dark"] as const).map((value) => ({
                  label: {
                    system: "跟随系统外观",
                    light: "浅色外观",
                    dark: "深色外观",
                  }[value],
                  icon: theme === value ? <CheckIcon size={16} /> : undefined,
                  actionId: `theme-${value}`,
                  onSelect: () => setTheme(value),
                })),
              ]}
            />
          </div>
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
            {label(id)}
            {id === "latest" && (
              <span className={styles.totalCount} aria-hidden="true">
                {articles.length}
              </span>
            )}
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
                  <h2>
                    {id === "latest" ? "最新文章" : name}{" "}
                    <span>{items.length}</span>
                  </h2>
                  <p>
                    {id === "latest"
                      ? "所有公司的最新发布"
                      : activeCompanies.has(id)
                        ? `最新 ${latest ? day(time(latest)) : "—"}`
                        : "历史收录 · 暂停新增"}
                  </p>
                </div>
                <MenuButton
                  actionId={`feed-${id}`}
                  label={`${id === "latest" ? "全站" : name}订阅`}
                  icon={<DotsThree size={21} />}
                  iconOnly
                  items={[
                    {
                      label: "订阅 RSS",
                      actionId: `rss-${id}`,
                      onSelect: () => openFeed(id),
                    },
                    {
                      label: "订阅 Atom",
                      actionId: `atom-${id}`,
                      onSelect: () => openFeed(id, true),
                    },
                  ]}
                />
              </div>
              <div
                ref={(el) => {
                  lists.current[id] = el;
                }}
                className={styles.panelList}
                role="region"
                aria-label={`${name}文章列表`}
                tabIndex={0}
              >
                {shown.map((a) => (
                  <article className={`board-story ${styles.story}`} key={a.id}>
                    <h3>
                      <Link prefetch={false} href={`/articles/${a.id}/`}>
                        {a.title}
                      </Link>
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
                      <a
                        className={styles.original}
                        href={a.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`阅读原文：${a.title}（在新标签页打开）`}
                      >
                        原文 <span aria-hidden="true">↗</span>
                      </a>
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
                {shown.length < items.length && (
                  <div className={styles.more}>
                    <Button
                      variant="ghost"
                      aria-label={`加载更多${name}文章`}
                      onClick={() => loadMore(id)}
                    >
                      加载更多{" "}
                      <span className={styles.moreCount}>
                        {shown.length} / {items.length}
                      </span>
                    </Button>
                  </div>
                )}
                {!!items.length && shown.length === items.length && (
                  <p className={styles.end}>已显示全部 {items.length} 篇</p>
                )}
              </div>
            </section>
          );
        })}
      </main>
      <footer className={styles.footer}>
        <span className={styles.sync}>
          <i aria-hidden="true" />
          更新于{" "}
          <time dateTime={site.generatedAt}>
            {new Date(site.generatedAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "Asia/Shanghai",
            })}
          </time>
        </span>
        <div className={styles.position}>
          <IconButton
            aria-label="向左切换面板"
            disabled={activeIndex === 0}
            onClick={() => locate(ids[activeIndex - 1])}
          >
            <ArrowLeft size={19} />
          </IconButton>
          <span aria-live="polite" aria-atomic="true">
            {activeIndex + 1} <i>/ {ids.length}</i>
          </span>
          <IconButton
            aria-label="向右切换面板"
            disabled={activeIndex === ids.length - 1}
            onClick={() => locate(ids[activeIndex + 1])}
          >
            <ArrowRight size={19} />
          </IconButton>
        </div>
      </footer>
    </div>
  );
}
