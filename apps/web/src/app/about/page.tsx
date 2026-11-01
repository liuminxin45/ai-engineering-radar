import type { Metadata } from "next";
import Link from "next/link";
import { asset } from "../../lib";
import { SourceContribution } from "../../components/source-contribution";

export const metadata: Metadata = {
  title: "关于 / About",
  description:
    "首批收录国内公司官方团队的工程文章，保留来源证据、去重与数据校验，提供 RSS / Atom 订阅，全文回到原站阅读。",
};

export default function About() {
  return (
    <article className="detail">
      <header className="intro">
        <h1>发现工程实践，回到原文阅读</h1>
        <p className="lede">
          一个开放的工程文章索引。首批追踪国内公司官方技术团队，
          帮你发现团队实践，回到原文阅读。
        </p>
      </header>

      <section className="detail-section" aria-labelledby="about-sources">
        <h2 id="about-sources">每篇文章都有出处</h2>
        <p>
          文章保留公司、发布主体、原文地址和来源关系。
          <Link href="/sources/">来源目录</Link>
          展示官方身份的公开证据、核验状态与采集结果，方便你核对原始材料。
        </p>
        <p>
          来源可以是国内公司自有技术站，也可以是第三方博客社区中的国内官方账号。
          公司归属根据具体发布主体核验。登记、身份核验与采集成功分别记录，
          覆盖情况以来源目录的当前状态为准。
        </p>
      </section>

      <section className="detail-section" aria-labelledby="about-scope">
        <h2 id="about-scope">首批收录政策</h2>
        <p>
          本批仅收录国内公司官方来源，暂不接入海外来源。
          已核验且启用的官方来源文章直接建立索引，保留身份核验、去重与数据校验，
          不做内容相关性筛选、模型审核或自动主题分类。
        </p>
        <p>
          发现文章归属、链接、日期或重复关系有误时， 欢迎在
          <a href="https://github.com/liuminxin45/ai-engineering-radar/issues">
            仓库 Issue
          </a>
          中提供原文地址和更正依据。
        </p>
      </section>

      <section className="detail-section" aria-labelledby="about-reading">
        <h2 id="about-reading">按需阅读与订阅</h2>
        <p>
          你可以搜索文章、按公司筛选，也可以使用全站和公司的 RSS / Atom 订阅。
          文章保留原始语言，全文在原站阅读。项目不复制、存储或分发文章全文。
        </p>
        <p>
          <Link href="/">浏览文章</Link>
          <span aria-hidden="true"> · </span>
          <a href={asset("/feed.xml")}>RSS 订阅</a>
          <span aria-hidden="true"> · </span>
          <a href={asset("/feed.atom")}>Atom 订阅</a>
        </p>
      </section>

      <SourceContribution />

      <section
        className="detail-section"
        lang="en"
        aria-labelledby="about-english"
      >
        <h2 id="about-english">About this project</h2>
        <p>
          AI Engineering Radar is an open index of engineering articles. This
          initial release follows official engineering teams at Chinese
          companies, from company blogs to verified accounts on third-party
          blogging communities. Overseas sources are outside this batch. Every
          article keeps its original URL, publisher, and source relationships;
          the source directory shows ownership evidence and collection status.
        </p>
        <p>
          Articles from verified, enabled official sources enter the index
          directly, with identity verification, deduplication, and data
          validation. There is no content relevance screening, model review, or
          automatic topic classification. Search by company or follow RSS / Atom
          feeds. Articles keep their original language. Full text stays on the
          original site; this project does not copy, store, or redistribute it.
        </p>
        <p>
          We welcome PRs that add or repair sources for Chinese companies,
          including official accounts on third-party communities. Include the
          company, publisher, stable account ID, public ownership evidence,
          permitted collection endpoint, and adapter fixtures with tests. See
          the{" "}
          <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/CONTRIBUTING.md">
            contribution guide
          </a>
          . Incomplete leads and evidence-backed corrections are welcome too.
        </p>
      </section>

      <p className="small muted">
        代码采用 MIT 许可。文章、摘要、名称和商标归相应权利人所有。
        如需更正或移除，请通过仓库 Issue 联系维护者。
      </p>
    </article>
  );
}
