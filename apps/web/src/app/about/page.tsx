import type { Metadata } from "next";
import Link from "next/link";
import { asset } from "../../lib";
import { SourceContribution } from "../../components/source-contribution";
import { DocumentFrame } from "../../components/document-frame";

export const metadata: Metadata = {
  title: "关于 / About",
  description:
    "收录国内公司官方团队的工程文章，保留来源证据、去重与数据校验，提供博文统一阅读与 RSS / Atom 订阅。",
};

export default function About() {
  return (
    <DocumentFrame>
      <article className="detail">
        <header className="intro">
          <h1>发现工程实践，持续阅读与学习</h1>
          <p className="lede">
            一个开放的工程文章索引。首批追踪国内公司官方技术团队，
            帮你发现团队实践，在统一的阅读页面中学习，并随时查看原文。
          </p>
        </header>

        <section className="detail-section" aria-labelledby="about-sources">
          <h2 id="about-sources">每篇文章都有出处</h2>
          <p>
            文章保留公司、发布主体、原文地址和来源关系。
            <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/docs/source-acceptance.md">
              仓库来源验收表
            </a>
            记录官方身份的公开证据、核验状态与采集结果，方便你核对原始材料。
          </p>
          <p>
            来源可以是国内公司自有技术站，也可以是第三方博客社区中的国内官方账号。
            公司归属根据具体发布主体核验。登记、身份核验与采集成功分别记录，
            覆盖情况以来源验收表和公开来源 JSON 的当前状态为准。
          </p>
        </section>

        <section className="detail-section" aria-labelledby="about-papers">
          <h2 id="about-papers">论文按机构署名归属</h2>
          <p>
            顶部“博文 /
            论文”切换共用公司分列看板。博文核验官方发布账号；论文使用出版方登记的作者机构、论文首页署名或公司自有研究目录核验归属。
            联合论文可归属多家公司，详情页和公开 JSON
            保留逐公司的证据链接与机构摘录。
          </p>
          <p>
            论文归属反映发表时的机构记录，不表示作者目前的任职情况。第三方目录的查询命中、提交人和正文提及不能单独证明机构归属；未取得有效证据的候选不收录。
            具体采集范围和未启用入口见
            <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/docs/paper-sources.md">
              论文来源核验
            </a>
            。
          </p>
        </section>

        <section className="detail-section" aria-labelledby="about-scope">
          <h2 id="about-scope">首批收录政策</h2>
          <p>
            本批收录国内公司的团队博文和研究论文，暂不扩展到海外公司。
            已核验且启用的官方来源文章直接建立索引，保留身份核验、去重与数据校验，
            不按评分筛选内容，也不做自动主题分类。
          </p>
          <p>
            发现文章归属、链接、日期或重复关系有误时， 欢迎在
            <a href="https://github.com/liuminxin45/ai-engineering-radar/issues">
              仓库 Issue
            </a>
            中提供原文地址和更正依据。
          </p>
        </section>

        <section className="detail-section" aria-labelledby="about-scores">
          <h2 id="about-scores">标题评分作为阅读参考</h2>
          <p>
            部分博文右下角显示 Jev 等评分服务给出的 0–100 分。
            分数只根据标题评估 AI 相关性、真实工程应用和技术实践深度，
            不代表正文质量已经验证，也不影响文章展示、排序或订阅。
            标题含糊时保守评分，热门模型名和公司知名度不加分。
          </p>
          <p>
            “疑似软文”标记优先，命中后不参与评分。
            评分服务不可用或尚未完成评分时，不显示分数，文章仍可正常阅读。
            论文不参与这项评分。
          </p>
        </section>

        <section className="detail-section" aria-labelledby="about-reading">
          <h2 id="about-reading">按需阅读与订阅</h2>
          <p>
            你可以按公司分列浏览、搜索文章。点击博文标题进入本站阅读页，顶部提供原文入口，
            每列触底时自动追加文章，右上角显示数据更新时间。 全站 RSS / Atom
            订阅统一追踪整个项目的更新。
            博文保留原始语言，统一排版并提供目录、阅读进度和图片预览。正文不可用或可能不完整时会明确提示，论文保留原站阅读方式。
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
            the repository source acceptance report records ownership evidence
            and collection status.
          </p>
          <p>
            Articles from verified, enabled official sources enter the index
            directly, with identity verification, deduplication, and data
            validation. Optional title scores estimate relevance to practical AI
            engineering; they do not verify full-text quality or filter
            articles. Suspected advertorials take precedence and are not scored.
            Papers are not scored. There is no automatic topic classification.
            Search the index or browse company columns; blog titles open a local
            reading page with a link to the original publication. Each column
            loads another batch at its bottom, and the update time appears at
            the top right. Follow project-wide updates through the site-wide RSS
            / Atom feeds. Articles keep their original language. Available blog
            text is saved and rendered with consistent typography, a table of
            contents and image previews. Missing or potentially incomplete text
            is clearly marked. Papers continue to open on the publishing site.
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
    </DocumentFrame>
  );
}
