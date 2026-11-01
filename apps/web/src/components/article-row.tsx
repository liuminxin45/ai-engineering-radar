import Link from "next/link";
import type { Article } from "../../../../packages/shared/types";
import { companyName, topicName } from "../lib";
import { LocalTime } from "./local-time";
export function ArticleRow({ article: a }: { article: Article }) {
  return (
    <article className="article-row">
      <div className="article-meta">
        <span className="company">{companyName(a.companyId)}</span>
        <span aria-hidden="true">/</span>
        <LocalTime value={a.publishedAt ?? a.discoveredAt} dateOnly />
        {!a.publishedAt && <span>发现日期</span>}
      </div>
      <h2>
        <Link href={`/articles/${a.id}/`}>{a.title}</Link>
      </h2>
      {a.description && <p className="excerpt">{a.description}</p>}
      <div className="article-bottom">
        <div className="tags">
          {a.classification.topics.map((t) => (
            <span key={t}>{topicName(t)}</span>
          ))}
        </div>
        <Link className="read-link" href={`/articles/${a.id}/`}>
          查看详情 <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
