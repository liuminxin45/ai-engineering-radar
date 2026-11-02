"use client";

import { useEffect, useId, useState } from "react";
import {
  Button,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Moon,
  Sun,
  CloseIcon,
  useDesktopTheme,
} from "chatgpt-desktop-kit";
import { asset } from "../lib";
import styles from "./board-actions.module.css";

const repository = "https://github.com/liuminxin45/ai-engineering-radar";

export function BoardActions() {
  const { theme, setTheme } = useDesktopTheme();
  const [systemDark, setSystemDark] = useState(false);
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const headingId = useId();
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    setOrigin(location.origin);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  async function copy(kind: string, path: string) {
    setCopied("");
    setError("");
    try {
      await navigator.clipboard.writeText(
        new URL(asset(path), location.origin).href,
      );
      setCopied(kind);
    } catch {
      setError("无法自动复制，请选中链接手动复制。");
    }
  }
  const themeLabel = dark ? "切换到浅色外观" : "切换到深色外观";
  return (
    <>
      <IconButton
        className={styles.flatButton}
        aria-label={themeLabel}
        title={themeLabel}
        onClick={() => setTheme(dark ? "light" : "dark")}
      >
        {dark ? (
          <Sun size={18} aria-hidden="true" />
        ) : (
          <Moon size={18} aria-hidden="true" />
        )}
      </IconButton>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setCopied("");
          setError("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            className={`${styles.flatButton} ${styles.feedTrigger}`}
            variant="ghost"
          >
            <span className="link-label">ATOM/RSS</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={styles.subscription}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={headingId}
        >
          <div className={styles.heading}>
            <h2 id={headingId}>订阅整个项目</h2>
            <button
              type="button"
              className={styles.flatButton}
              aria-label="关闭订阅窗口"
              onClick={() => setOpen(false)}
            >
              <CloseIcon size={18} aria-hidden="true" />
            </button>
          </div>
          <p className={styles.description}>
            复制链接到阅读器，持续追踪新文章。
          </p>
          {[
            ["RSS", "/feed.xml"],
            ["ATOM", "/feed.atom"],
          ].map(([kind, path]) => (
            <div className={styles.feed} key={kind}>
              <div className={styles.feedHead}>
                <span>{kind}</span>
                <Button
                  variant="ghost"
                  className={styles.copy}
                  aria-label={`复制 ${kind} 链接`}
                  onClick={() => void copy(kind, path)}
                >
                  {copied === kind ? "已复制" : "复制"}
                </Button>
              </div>
              <a href={asset(path)} className={styles.feedUrl}>
                {origin ? new URL(asset(path), origin).href : asset(path)}
              </a>
            </div>
          ))}
          <p className={styles.status} role="status" aria-live="polite">
            {error || (copied ? `${copied} 链接已复制` : "")}
          </p>
        </PopoverContent>
      </Popover>
      <a
        className={`${styles.flatButton} ${styles.github}`}
        href={repository}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub 项目"
        title="GitHub 项目"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.763-1.605-2.665-.305-5.467-1.335-5.467-5.93 0-1.31.47-2.382 1.235-3.222-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.51 11.51 0 0 1 3-.404c1.02.005 2.047.138 3 .404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.12 3.176.77.84 1.232 1.912 1.232 3.222 0 4.607-2.807 5.62-5.48 5.917.43.372.823 1.102.823 2.222 0 1.606-.015 2.9-.015 3.293 0 .32.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
    </>
  );
}
