import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };
export function Search({ size = 18, strokeWidth = 1.75, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
export function X({ size = 20, strokeWidth = 1.6, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      {...props}
    >
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}
export function SearchX({ size = 44, strokeWidth = 1.25, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3m-8.4-8.4 5.4 5.4m0-5.4-5.4 5.4" />
    </svg>
  );
}
export function LoaderCircle({ size = 22, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      {...props}
    >
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  );
}
