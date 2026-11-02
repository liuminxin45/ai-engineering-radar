"use client";

import { useEffect, type RefObject } from "react";
import { boardWheelDelta } from "../board-wheel";

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
    const cancelQueued = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      destination = null;
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
      const start = destination ?? board.scrollLeft;
      const next = Math.max(
        0,
        Math.min(board.scrollWidth - board.clientWidth, start + delta),
      );
      if (Math.abs(next - start) < 0.001) return;
      event.preventDefault();
      board.dataset.wheelScroll = "true";
      destination = next;
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          const left = destination;
          destination = null;
          if (left !== null)
            board.scrollTo({
              left: Math.max(
                0,
                Math.min(board.scrollWidth - board.clientWidth, left),
              ),
              behavior: "instant",
            });
        });
    };
    // Non-passive listeners allow cancellation only when a horizontal move is consumed.
    for (const element of [board, nav]) {
      element.addEventListener("wheel", wheel, { passive: false });
      element.addEventListener("touchstart", touch, { passive: true });
      element.addEventListener("pointerdown", reset, { passive: true });
      element.addEventListener("keydown", reset);
    }
    window.addEventListener("resize", reset);
    return () => {
      cancelQueued();
      for (const element of [board, nav]) {
        element.removeEventListener("wheel", wheel);
        element.removeEventListener("touchstart", touch);
        element.removeEventListener("pointerdown", reset);
        element.removeEventListener("keydown", reset);
      }
      window.removeEventListener("resize", reset);
      delete board.dataset.wheelScroll;
    };
  }, [viewport, companyNav, navigation]);
}
