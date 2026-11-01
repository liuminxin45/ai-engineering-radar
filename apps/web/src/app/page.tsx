import Link from "next/link";
import { ArticleIndex } from "../components/article-index";
import { LocalTime } from "../components/local-time";
import { site } from "../lib";
export default function Home() {
  return (
    <>
      <section className="intro">
        <h1>国内技术文章</h1>
        <p className="lede">国内公司官方技术账号的文章，按公司与时间浏览。</p>
        <div className="coverage">
          <Link href="/sources/">{site.health.sourceCount} 个来源</Link>
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
