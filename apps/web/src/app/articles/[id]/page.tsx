import Link from "next/link";
import { notFound } from "next/navigation";
import { site, companyName, asset } from "../../../lib";
import { LocalTime } from "../../../components/local-time";
import { DocumentFrame } from "../../../components/document-frame";
import { articleCompanyIds } from "../../../../../../packages/shared/content.ts";
export const dynamicParams = false;
export function generateStaticParams() {
  return site.articles.length
    ? site.articles.map((a) => ({ id: a.id }))
    : [{ id: "unavailable" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = site.articles.find((a) => a.id === id);
  return {
    title: a?.title ?? "文章未找到",
    description: a?.description,
    alternates: { canonical: `articles/${id}/` },
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = site.articles.find((a) => a.id === id);
  if (!a) notFound();
  return (
    <DocumentFrame>
      <article className="detail">
        <Link
          className="back-link"
          href={a.contentType === "paper" ? "/?type=paper" : "/"}
        >
          ← 返回{a.contentType === "paper" ? "论文" : "博文"}索引
        </Link>
        <div className="article-meta">
          <span className="company">
            {articleCompanyIds(a).map(companyName).join("、")}
          </span>
          <span aria-hidden="true">/</span>
          <LocalTime value={a.publishedAt ?? a.discoveredAt} dateOnly />
          {!a.publishedAt && <span>发现日期，原文未提供发布时间</span>}
        </div>
        <h1>
          <a href={a.canonicalUrl} target="_blank" rel="noopener noreferrer">
            <span className="link-label">{a.title}</span>
          </a>
        </h1>
        {a.description && <p className="detail-description">{a.description}</p>}
        <p className="small muted">
          本站仅提供{a.contentType === "paper" ? "论文" : "文章"}
          索引和简短介绍，完整内容请在原站阅读。
        </p>
        {a.advertorial?.status === "suspected" && (
          <section className="detail-section" id="advertorial-review">
            <h2>疑似软文 · 试运行</h2>
            <p>{a.advertorial.reason}</p>
            {a.advertorial.evidence.length > 0 && (
              <ul>
                {a.advertorial.evidence.map((e, index) => (
                  <li key={index}>
                    {e.field === "title" ? "标题" : "摘要"}：<q>{e.text}</q>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted">
              此标记仅供人工复核，文章继续展示并保留在搜索和订阅中。
              如需更正，请在 GitHub Issue 中提供原文地址和说明。
            </p>
          </section>
        )}
        {a.contentType === "paper" && a.paperAffiliations && (
          <section className="detail-section" aria-label="论文公司归属依据">
            <h2>公司归属依据</h2>
            <p className="small muted">
              依据发表时的作者机构署名或官方研究目录记录，不代表作者目前的任职情况。
            </p>
            <ul className="locations">
              {a.paperAffiliations.map((proof) => (
                <li key={`${proof.companyId}:${proof.evidenceUrl}`}>
                  <a
                    href={proof.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {companyName(proof.companyId)} ·{" "}
                    {proof.method === "paper-authors"
                      ? "作者机构署名"
                      : "官方研究目录"}{" "}
                    ↗
                  </a>
                  <p className="small muted">{proof.excerpt}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="detail-section">
          <h2>来源与发布信息</h2>
          <dl>
            <div>
              <dt>发布主体</dt>
              <dd>
                {site.publishers.find((p) => p.id === a.publisherId)?.name}
              </dd>
            </div>
            {a.author && (
              <div>
                <dt>原文作者</dt>
                <dd>{a.author}</dd>
              </div>
            )}
            <div>
              <dt>发现时间</dt>
              <dd>
                <LocalTime value={a.discoveredAt} />
              </dd>
            </div>
            <div>
              <dt>全部发布地址</dt>
              <dd>
                <ul className="locations">
                  {a.locations.map((l) => (
                    <li key={l.sourceId + l.url}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        {site.sources.find((s) => s.id === l.sourceId)?.name ??
                          l.sourceId}{" "}
                        ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <p className="small">
            <a href={asset(`/data/articles/${a.id}.json`)}>文章 JSON</a>
          </p>
        </section>
      </article>
    </DocumentFrame>
  );
}
