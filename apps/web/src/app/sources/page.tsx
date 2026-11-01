import type { Metadata } from "next";
import { site, statusNames, companyName, asset } from "../../lib";
import { LocalTime } from "../../components/local-time";
export const metadata: Metadata = { title: "来源目录" };
export default function Sources() {
  return (
    <>
      <section className="intro source-intro">
        <h1>从可信来源开始</h1>
        <p className="lede">
          每个入口都保留发布主体、官方核验证据和采集结果。登记来源不代表已经启用，社区平台中的第三方投稿不会自动归属平台公司。
        </p>
        <div className="coverage">
          <span>{site.sources.length} 个登记入口</span>
          <span aria-hidden="true">·</span>
          <span>
            {site.sources.filter((s) => s.crawl.enabled).length} 个已启用
          </span>
          <span aria-hidden="true">·</span>
          <a href={asset("/data/sources.json")}>下载来源 JSON</a>
        </div>
        <p className="small muted">
          知道更多官方技术账号？欢迎
          <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/CONTRIBUTING.md">
            提交 PR 适配新来源
          </a>
          ，支持官网及大型博客社区上的官方账号。
        </p>
      </section>
      {(["cn"] as const).map((region) => (
        <section className="source-group" key={region}>
          <h2>国内公司</h2>
          {site.sources
            .filter(
              (s) =>
                site.companies.find(
                  (c) =>
                    c.id ===
                    site.publishers.find((p) => p.id === s.publisherId)
                      ?.companyId,
                )?.region === region,
            )
            .map((s) => (
              <article className="source-row" key={s.id}>
                <div className="source-heading">
                  <h3>
                    <a
                      href={s.entryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.name} <span aria-hidden="true">↗</span>
                    </a>
                  </h3>
                  <span
                    className={`badge ${s.verification.status === "verified" ? "verified" : ""}`}
                  >
                    {statusNames[s.verification.status]}
                  </span>
                </div>
                <p>{s.verification.note}</p>
                <div className="source-facts">
                  <span>优先级 {s.priority}</span>
                  <span>
                    {s.verification.status === "suspended"
                      ? "历史渠道"
                      : s.crawl.enabled
                        ? "已启用"
                        : "未启用"}
                  </span>
                  <span
                    className={
                      s.state.status === "success" ||
                      s.state.status === "not-modified"
                        ? "good"
                        : ""
                    }
                  >
                    {statusNames[s.state.status]}
                  </span>
                  <span>{s.state.discovered} 条发现</span>
                </div>
                {s.state.error && (
                  <p className="source-error">最近说明：{s.state.error}</p>
                )}
                <div className="source-timestamps small muted">
                  <span>
                    最新收录文章{" "}
                    {s.latestPublishedAt ? (
                      <LocalTime value={s.latestPublishedAt} dateOnly />
                    ) : (
                      "暂无发布日期"
                    )}
                  </span>
                  {s.state.lastCheckedAt && (
                    <span>
                      最近检测 <LocalTime value={s.state.lastCheckedAt} />
                    </span>
                  )}
                  {s.state.lastSuccessAt && (
                    <span>
                      最近成功 <LocalTime value={s.state.lastSuccessAt} />
                    </span>
                  )}
                </div>
                {s.verification.evidenceUrls.length > 0 && (
                  <p className="small">
                    核验证据：
                    {s.verification.evidenceUrls.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {i ? " · " : ""}证据 {i + 1}
                      </a>
                    ))}
                    {s.verification.reviewedAt && (
                      <span className="muted">
                        {" "}
                        · 核验于{" "}
                        <LocalTime value={s.verification.reviewedAt} dateOnly />
                      </span>
                    )}
                  </p>
                )}
              </article>
            ))}
        </section>
      ))}
    </>
  );
}
