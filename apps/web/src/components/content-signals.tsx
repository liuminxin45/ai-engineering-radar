import type { Article } from "../../../../packages/shared/types";
import {
  assessContentSignals,
  contentSignalLabels,
} from "../../../../packages/classifier/content-signals";
import { ArticleLink } from "./article-link";
import styles from "./content-signals.module.css";

export function ContentSignalBadge({ article }: { article: Article }) {
  const signals = assessContentSignals(article);
  return (
    <ArticleLink
      className={styles.badge}
      href={`/articles/${article.id}/#content-signals`}
      aria-label={`${signals.label}：查看标题摘要规则依据`}
    >
      {signals.label}
    </ArticleLink>
  );
}

export function ContentSignalReview({ article }: { article: Article }) {
  const signals = assessContentSignals(article);
  return (
    <details className="detail-section" id="content-signals">
      <summary>
        {signals.kinds.map((k) => contentSignalLabels[k]).join(" · ")} ·
        查看依据
      </summary>
      <p>{signals.reason}</p>
      <ul>
        {signals.evidence.map((e, i) => (
          <li key={i}>
            {e.field === "title" ? "标题" : "摘要"}：<q>{e.text}</q>
          </li>
        ))}
      </ul>
      <p className="small muted">
        仅依据标题和摘要，未审核全文。标签不改变收录、搜索或订阅；待判断不代表不相关。
        如需更正，请在 GitHub Issue 提供原文与说明。规则版本：{signals.version}
        。
      </p>
    </details>
  );
}
