export type BoardWheelInput = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
};

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
