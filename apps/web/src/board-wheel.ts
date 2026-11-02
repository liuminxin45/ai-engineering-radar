export type BoardWheelInput = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
};

export const BOARD_WHEEL_DURATION_MS = 180;

/** Cover most of the distance early, then settle without overshooting. */
export function boardWheelProgress(elapsed: number) {
  const progress = Math.max(0, Math.min(1, elapsed / BOARD_WHEEL_DURATION_MS));
  return 1 - (1 - progress) ** 3;
}

/** Keep the dominant gesture axis and normalize line/page units into pixels. */
export function boardWheelDelta(
  event: BoardWheelInput,
  pageWidth: number,
  lineHeight = 16,
) {
  if (event.ctrlKey || event.metaKey) return 0;
  if (!Number.isFinite(event.deltaX) || !Number.isFinite(event.deltaY))
    return 0;
  const delta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
  const scale =
    event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageWidth : 1;
  return Number.isFinite(scale) && scale > 0 ? delta * scale : 0;
}
