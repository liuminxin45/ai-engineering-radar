import Link from "next/link";
import { notFound } from "next/navigation";
import { site, companyName, asset } from "../../../lib";
import { LocalTime } from "../../../components/local-time";
import { DocumentFrame } from "../../../components/document-frame";
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
        <Link className="back-link" href="/">
          ← 返回文章索引
        </Link>
        <div className="article-meta">
          <span className="company">{companyName(a.companyId)}</span>
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
          本站仅提供文章索引和简短介绍，完整内容请在原站阅读。
        </p>
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
