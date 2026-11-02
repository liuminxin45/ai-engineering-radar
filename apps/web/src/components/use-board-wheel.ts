"use client";

import { useEffect, type RefObject } from "react";
import { boardWheelDelta, boardWheelProgress } from "../board-wheel";

/** Translate wheel input over the board chrome; article bodies keep native scrolling. */
export function useBoardWheel(
  viewport: RefObject<HTMLElement | null>,
  companyNav: RefObject<HTMLElement | null>,
  navigation: RefObject<boolean>,
) {
  useEffect(() => {
    const board = viewport.current,
      nav = companyNav.current;
    if (!board || !nav) return;
    let frame: number | null = null;
    let destination: number | null = null;
    let origin = 0;
    let startedAt = 0;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const clamp = (left: number) =>
      Math.max(0, Math.min(board.scrollWidth - board.clientWidth, left));
    const cancelQueued = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      destination = null;
    };
    const animate = (now: number) => {
      frame = null;
      if (destination === null) return;
      const target = clamp(destination);
      const progress = boardWheelProgress(now - startedAt);
      board.scrollTo({
        left: clamp(origin + (target - origin) * progress),
        behavior: "instant",
      });
      if (progress < 1) frame = requestAnimationFrame(animate);
      else destination = null;
    };
    const reduceMotion = () => {
      if (!motion.matches || destination === null) return;
      const target = destination;
      cancelQueued();
      board.scrollTo({ left: clamp(target), behavior: "instant" });
    };
    const interruptNavigation = () => {
      if (navigation.current) {
        navigation.current = false;
        board.scrollTo({ left: board.scrollLeft, behavior: "instant" });
      }
    };
    const reset = () => {
      cancelQueued();
      interruptNavigation();
    };
    const touch = () => {
      reset();
      delete board.dataset.wheelScroll;
    };
    const wheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (!(event.target instanceof Element)) return;
      const delta = boardWheelDelta(
        event,
        board.clientWidth,
        Number.parseFloat(getComputedStyle(board).lineHeight) || 16,
      );
      if (!delta) return;
      // Explicit manual input takes over an in-flight company navigation.
      interruptNavigation();
      if (event.target.closest("[data-board-list]")) {
        cancelQueued();
        return;
      }
      const current = board.scrollLeft;
      // Reversing cancels the unfinished tail instead of waiting for it to finish.
      const reversing =
        destination !== null && (destination - current) * delta < 0;
      const start = reversing ? current : (destination ?? current);
      const next = clamp(start + delta);
      if (reversing) cancelQueued();
      if (Math.abs(next - start) < 0.001) return;
      event.preventDefault();
      board.dataset.wheelScroll = "true";
      cancelQueued();
      if (motion.matches) {
        board.scrollTo({ left: next, behavior: "instant" });
        return;
      }
      origin = current;
      startedAt = performance.now();
      destination = next;
      frame = requestAnimationFrame(animate);
    };
    // Non-passive listeners allow cancellation only when a horizontal move is consumed.
    for (const element of [board, nav]) {
      element.addEventListener("wheel", wheel, { passive: false });
    }
    // Capture outside interactions too: toolbar tabs/search/history can reposition the board.
    window.addEventListener("touchstart", touch, {
      passive: true,
      capture: true,
    });
    window.addEventListener("pointerdown", reset, {
      passive: true,
      capture: true,
    });
    window.addEventListener("keydown", reset, true);
    window.addEventListener("popstate", reset);
    window.addEventListener("resize", reset);
    motion.addEventListener("change", reduceMotion);
    return () => {
      cancelQueued();
      for (const element of [board, nav]) {
        element.removeEventListener("wheel", wheel);
      }
      window.removeEventListener("touchstart", touch, true);
      window.removeEventListener("pointerdown", reset, true);
      window.removeEventListener("keydown", reset, true);
      window.removeEventListener("popstate", reset);
      window.removeEventListener("resize", reset);
      motion.removeEventListener("change", reduceMotion);
      delete board.dataset.wheelScroll;
    };
  }, [viewport, companyNav, navigation]);
}
