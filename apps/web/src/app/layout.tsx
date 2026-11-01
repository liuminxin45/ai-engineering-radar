import type { Metadata } from "next";
import Link from "next/link";
import { SiteUiProvider } from "../components/site-ui-provider";
import "chatgpt-desktop-kit/components.css";
import "./globals.css";
const origin =
  (process.env.SITE_URL ?? "http://localhost:3000") +
  (process.env.BASE_PATH ?? "");
export const metadata: Metadata = {
  metadataBase: new URL(origin + "/"),
  title: {
    default: "AI Engineering Radar · 国内技术文章索引",
    template: "%s · AI Engineering Radar",
  },
  description: "按公司与时间浏览国内官方技术团队的文章，回到原文阅读。",
  alternates: {
    types: {
      "application/rss+xml": origin + "/feed.xml",
      "application/atom+xml": origin + "/feed.atom",
    },
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteUiProvider>
          <a className="skip-link" href="#main">
            跳转到主要内容
          </a>
          <div className="shell">
            <header className="header">
              <Link className="brand" href="/">
                <span className="radar-mark" aria-hidden="true" />
                <span>
                  AI Engineering <strong>Radar</strong>
                </span>
              </Link>
              <nav aria-label="主导航">
                <Link href="/sources/">来源目录</Link>
                <Link href="/about/">关于</Link>
                <a
                  href="https://github.com/liuminxin45/ai-engineering-radar"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub <span aria-hidden="true">↗</span>
                </a>
              </nav>
            </header>
            <main id="main">{children}</main>
            <footer>
              <p>
                文章版权归原作者。
                <span aria-hidden="true"> · </span>
                <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/CONTRIBUTING.md">
                  提交 PR 适配新来源
                </a>
              </p>
            </footer>
          </div>
        </SiteUiProvider>
      </body>
    </html>
  );
}
