"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "./action-button";
import { ThemeToggle } from "./theme-toggle";
import { asset, base } from "../lib";

export function ReaderActions({
  id,
  originalUrl,
}: {
  id: string;
  originalUrl: string;
}) {
  const router = useRouter();
  useEffect(() => {
    try {
      const origin = JSON.parse(
        sessionStorage.getItem("radar:reader-origin") || "null",
      );
      if (
        origin?.target === `/articles/${id}/` &&
        typeof origin.returnTo === "string" &&
        origin.returnTo.split("?")[0] === asset("/")
      ) {
        history.replaceState(
          {
            ...history.state,
            radarReturnTo: origin.returnTo,
            radarReturnSteps:
              Number.isInteger(origin.steps) && origin.steps > 0
                ? origin.steps
                : 1,
          },
          "",
        );
        sessionStorage.removeItem("radar:reader-origin");
      }
    } catch {
      /* Direct links use the default board. */
    }
  }, [id]);
  function back() {
    const returnTo = history.state?.radarReturnTo;
    if (
      typeof returnTo === "string" &&
      returnTo.split("?")[0] === asset("/") &&
      history.length > 1
    )
      history.go(
        -Math.min(history.state.radarReturnSteps || 1, history.length - 1),
      );
    else router.push("/");
  }
  return (
    <div className="reader-actions">
      <IconButton
        aria-label="返回博文看板"
        onClick={back}
        className="reader-back"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </IconButton>
      <a className="reader-brand" href={`${base}/`}>
        AI Engineering Radar
      </a>
      <div className="reader-utilities">
        <ThemeToggle />
        <a
          className="reader-original"
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="link-label">阅读原文</span>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </a>
      </div>
    </div>
  );
}
