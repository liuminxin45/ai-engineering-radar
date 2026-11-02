import { describe, it, expect } from "vitest";
import {
  boardWheelDelta,
  boardWheelProgress,
  type BoardWheelInput,
} from "../../apps/web/src/board-wheel.js";
const event = (patch: Partial<BoardWheelInput> = {}): BoardWheelInput => ({
  deltaX: 0,
  deltaY: 100,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  ...patch,
});
describe("board wheel gesture normalization", () => {
  it("starts quickly and settles within 180ms without overshooting", () => {
    const first = boardWheelProgress(60),
      second = boardWheelProgress(120);
    expect(boardWheelProgress(0)).toBe(0);
    expect(first).toBeGreaterThan(0.65);
    expect(second).toBeGreaterThan(first);
    expect(second - first).toBeLessThan(first);
    expect(1 - second).toBeLessThan(0.05);
    expect(boardWheelProgress(180)).toBe(1);
    expect(boardWheelProgress(1000)).toBe(1);
  });
  it("maps signed vertical mouse input without amplifying its speed", () => {
    expect(boardWheelDelta(event(), 1200)).toBe(100);
    expect(boardWheelDelta(event({ deltaY: -100 }), 1200)).toBe(-100);
  });
  it("keeps the dominant trackpad axis instead of adding both axes", () => {
    expect(boardWheelDelta(event({ deltaX: -80, deltaY: 20 }), 1200)).toBe(-80);
    expect(boardWheelDelta(event({ deltaX: 30, deltaY: 80 }), 1200)).toBe(80);
  });
  it("preserves fractional high-resolution wheel increments", () => {
    expect(boardWheelDelta(event({ deltaY: 0.125 }), 1200)).toBe(0.125);
  });
  it("normalizes line and page scrolling using the viewport metrics", () => {
    expect(boardWheelDelta(event({ deltaY: 3, deltaMode: 1 }), 1200, 20)).toBe(
      60,
    );
    expect(boardWheelDelta(event({ deltaY: -1, deltaMode: 2 }), 900)).toBe(
      -900,
    );
  });
  it("leaves browser zoom and system-modified gestures untouched", () => {
    expect(boardWheelDelta(event({ ctrlKey: true }), 1200)).toBe(0);
    expect(boardWheelDelta(event({ metaKey: true }), 1200)).toBe(0);
  });
  it("rejects invalid input without moving the board", () => {
    expect(boardWheelDelta(event({ deltaX: NaN }), 1200)).toBe(0);
    expect(boardWheelDelta(event({ deltaY: Infinity }), 1200)).toBe(0);
    expect(boardWheelDelta(event({ deltaMode: 2 }), 0)).toBe(0);
  });
});
