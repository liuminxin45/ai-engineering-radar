"use client";

import { DesktopProvider, UIStringsProvider } from "chatgpt-desktop-kit";
import type { ReactNode } from "react";

export function SiteUiProvider({ children }: { children: ReactNode }) {
  return (
    <DesktopProvider defaultTheme="system" className="radar-ui">
      <UIStringsProvider locale="zh-CN">{children}</UIStringsProvider>
    </DesktopProvider>
  );
}
