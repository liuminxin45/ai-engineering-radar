"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useDesktopTheme } from "chatgpt-desktop-kit";
import { IconButton } from "./action-button";

const moonPath =
  "M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z";
const sunPath =
  "M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z";

function clearTransition() {
  const root = document.documentElement;
  delete root.dataset.themeTransition;
  for (const property of ["x", "y", "radius"])
    root.style.removeProperty(`--theme-transition-${property}`);
}

export function ThemeToggle() {
  const { theme, setTheme } = useDesktopTheme();
  const [systemDark, setSystemDark] = useState(false);
  const icon = useRef<SVGSVGElement>(null);
  const previousDark = useRef<boolean | null>(null);
  const transition = useRef<ViewTransition | null>(null);
  const transitioning = useRef(false);
  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const previous = previousDark.current;
    previousDark.current = dark;
    if (
      previous === null ||
      previous === dark ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !icon.current?.animate
    )
      return;
    const animation = icon.current.animate(
      [
        { opacity: 0, transform: `rotate(${dark ? -16 : 16}deg) scale(.88)` },
        { opacity: 1, transform: "rotate(0deg) scale(1)" },
      ],
      { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    return () => animation.cancel();
  }, [dark]);

  useEffect(
    () => () => {
      transition.current?.skipTransition();
      clearTransition();
    },
    [],
  );

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    if (transitioning.current) return;
    const next = dark ? "light" : "dark";
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      // The new snapshot must capture React's updated theme and icon together.
      flushSync(() => setTheme(next));
    };
    if (
      typeof document.startViewTransition !== "function" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    );
    const root = document.documentElement;
    root.style.setProperty("--theme-transition-x", `${x}px`);
    root.style.setProperty("--theme-transition-y", `${y}px`);
    root.style.setProperty("--theme-transition-radius", `${radius}px`);
    root.dataset.themeTransition = "true";
    transitioning.current = true;
    const finish = () => {
      apply();
      transition.current = null;
      transitioning.current = false;
      clearTransition();
    };
    try {
      transition.current = document.startViewTransition(apply);
      void transition.current.finished.then(finish, finish);
    } catch {
      finish();
    }
  }

  const label = dark ? "切换到浅色外观" : "切换到深色外观";
  return (
    <IconButton aria-label={label} onClick={toggleTheme}>
      <svg
        ref={icon}
        key={dark ? "sun" : "moon"}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d={dark ? sunPath : moonPath}
          fillRule={dark ? undefined : "evenodd"}
          clipRule={dark ? undefined : "evenodd"}
        />
      </svg>
    </IconButton>
  );
}
