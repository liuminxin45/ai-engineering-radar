import type { Metadata } from "next";
import Link from "next/link";
import { asset } from "../lib";
import "./globals.css";
const origin =
  (process.env.SITE_URL ?? "http://localhost:3000") +
  (process.env.BASE_PATH ?? "");
export const metadata: Metadata = {
  metadataBase: new URL(origin + "/"),
  title: {
    default: "AI Engineering Radar · 发现真实的 AI 工程实践",
    template: "%s · AI Engineering Radar",
  },
  description:
    "持续追踪全球科技公司的官方技术团队，发现 Agent、AI Coding、模型应用与基础设施的工程实践。",
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
              <a href={asset("/feed.xml")}>RSS</a>
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
            <div>
              <strong>AI Engineering Radar</strong>
              <p>发现工程实践，回到原文阅读。</p>
            </div>
            <p>
              索引与代码开放。文章及摘要版权归原作者。
              <br />
              <a href="https://github.com/liuminxin45/ai-engineering-radar">
                参与维护
              </a>
              <span aria-hidden="true"> · </span>
              <a href={asset("/feed.atom")}>Atom 订阅</a>
              <span aria-hidden="true"> · </span>
              <a href={asset("/data/health.json")}>采集快照</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
