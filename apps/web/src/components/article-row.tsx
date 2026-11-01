import Link from "next/link";
import type { Article } from "../../../../packages/shared/types";
import { companyName } from "../lib";
import { LocalTime } from "./local-time";
export function ArticleRow({ article: a }: { article: Article }) {
  return (
    <article className="article-row">
      <div className="article-heading">
        <h2>
          <Link href={`/articles/${a.id}/`}>
            <span className="link-label">{a.title}</span>
          </Link>
        </h2>
        <div className="article-date">
          <LocalTime value={a.publishedAt ?? a.discoveredAt} dateOnly />
          {!a.publishedAt && <span>发现日期</span>}
        </div>
      </div>
      <div className="article-bottom">
        <div className="article-meta">
          <span className="company">{companyName(a.companyId)}</span>
        </div>
        <a
          className="read-link"
          href={a.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`阅读原文：${a.title}（在新标签页打开）`}
        >
          原文 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
