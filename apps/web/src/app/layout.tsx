import type { Metadata } from "next";
import { resolveSiteUrl } from "../../../../packages/shared/site";
import { SiteUiProvider } from "../components/site-ui-provider";
import "chatgpt-desktop-kit/components.css";
import "./globals.css";
const origin = resolveSiteUrl();
export const metadata: Metadata = {
  metadataBase: new URL(origin + "/"),
  title: {
    default: "AI Engineering Radar · 国内技术文章索引",
    template: "%s · AI Engineering Radar",
  },
  description:
    "按公司与时间浏览国内官方技术团队的文章，在统一阅读页学习并随时查看原文。",
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
          {children}
        </SiteUiProvider>
      </body>
    </html>
  );
}
