import type { Metadata } from "next";
import {
  DEFAULT_BASE_PATH,
  resolveSiteUrl,
} from "../../../../packages/shared/site";
import { SiteUiProvider } from "../components/site-ui-provider";
import "chatgpt-desktop-kit/components.css";
import "./globals.css";
const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const origin = resolveSiteUrl();
export const metadata: Metadata = {
  metadataBase: new URL(origin + "/"),
  title: {
    default: "AI Engineering Radar · 国内技术文章索引",
    template: "%s · AI Engineering Radar",
  },
  description: "按公司与时间浏览国内官方技术团队的文章，回到原文阅读。",
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico`, sizes: "16x16 32x32 48x48" },
      { url: `${basePath}/favicon.svg`, type: "image/svg+xml", sizes: "any" },
    ],
    apple: [
      {
        url: `${basePath}/apple-touch-icon.png`,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
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
