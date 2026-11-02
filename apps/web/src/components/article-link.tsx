"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function ArticleLink({
  href,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  const internal = href.startsWith("/articles/");
  if (!internal)
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        window.dispatchEvent(new Event("radar:save-board"));
        try {
          const pending = JSON.parse(
            sessionStorage.getItem("radar:reader-origin") || "null",
          );
          const continuing =
            typeof pending?.target === "string" &&
            location.pathname.endsWith(pending.target);
          const reading = /\/articles\//.test(location.pathname);
          const priorSteps = continuing
            ? pending.steps
            : reading
              ? history.state?.radarReturnSteps
              : 0;
          sessionStorage.setItem(
            "radar:reader-origin",
            JSON.stringify({
              target: href,
              returnTo:
                (continuing && pending.returnTo) ||
                (reading && history.state?.radarReturnTo) ||
                location.pathname + location.search,
              steps:
                (Number.isSafeInteger(priorSteps) && priorSteps > 0
                  ? priorSteps
                  : 0) + 1,
            }),
          );
        } catch {
          /* Navigation works without session storage. */
        }
      }}
    >
      {children}
    </Link>
  );
}
