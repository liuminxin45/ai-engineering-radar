/** Radar R: the full mark retains a signal dot; the favicon uses a simplified R. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-brand="radar-r"
    >
      <path
        d="M11 8h22c12 0 19 7 19 17 0 8-4 13-11 16l14 15H40L26 40h-3v16H11V8Zm12 10v12h10c5 0 8-2 8-6s-3-6-8-6H23Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <circle cx="56" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}
