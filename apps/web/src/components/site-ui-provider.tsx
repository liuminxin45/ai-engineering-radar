"use client";

import { DesktopProvider, UIStringsProvider } from "chatgpt-desktop-kit";
import { useEffect, useState, type ReactNode } from "react";

export function SiteUiProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("radar-theme");
      if (saved === "system" || saved === "light" || saved === "dark")
        setTheme(saved);
    } catch {
      /* Storage is optional. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("radar-theme", theme);
      } catch {
        /* Storage is optional. */
      }
  }, [theme, ready]);
  return (
    <DesktopProvider
      theme={theme}
      onThemeChange={setTheme}
      data-preference={theme}
      className="radar-ui"
    >
      <UIStringsProvider locale="zh-CN">{children}</UIStringsProvider>
    </DesktopProvider>
  );
}
