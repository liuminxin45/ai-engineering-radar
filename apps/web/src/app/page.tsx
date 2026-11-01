import Link from "next/link";
import { ArticleIndex } from "../components/article-index";
import { LocalTime } from "../components/local-time";
import { site } from "../lib";
export default function Home() {
  return (
    <>
      <section className="intro">
        <p className="eyebrow">OFFICIAL SOURCES. PRACTICAL ENGINEERING.</p>
        <h1>
          发现真实的
          <br className="mobile-break" /> AI 工程实践
        </h1>
        <p className="lede">
          持续追踪全球科技公司的官方技术团队，聚合 Agent、AI
          Coding、模型应用与基础设施实践。
        </p>
        <div className="coverage">
          <span className="status-dot" aria-hidden="true" />
          <span>{site.health.successfulSources} 个来源采集成功</span>
          <span aria-hidden="true">·</span>
          <Link href="/sources/">{site.health.sourceCount} 个登记入口</Link>
          <span aria-hidden="true">·</span>
          <span>
            更新于 <LocalTime value={site.generatedAt} />
          </span>
        </div>
      </section>
      <ArticleIndex />
    </>
  );
}
