import Link from "next/link";
import type { ReactNode } from "react";

export function DocumentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="header">
        <Link className="brand" prefetch={false} href="/">
          <span className="radar-mark" aria-hidden="true" />
          <span>
            AI Engineering <strong>Radar</strong>
          </span>
        </Link>
        <nav aria-label="主导航">
          <Link prefetch={false} href="/">
            文章
          </Link>
          <Link prefetch={false} href="/about/">
            关于
          </Link>
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
          文章版权归原作者。<span aria-hidden="true"> · </span>
          <a href="https://github.com/liuminxin45/ai-engineering-radar/blob/main/CONTRIBUTING.md">
            提交 PR 适配新来源
          </a>
        </p>
      </footer>
    </div>
  );
}
