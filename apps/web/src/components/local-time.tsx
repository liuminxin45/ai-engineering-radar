"use client";
import { useEffect, useState } from "react";
export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: string;
  dateOnly?: boolean;
}) {
  const [label, setLabel] = useState(value.slice(0, 10));
  useEffect(
    () =>
      setLabel(
        new Date(value).toLocaleString(
          "zh-CN",
          dateOnly
            ? { year: "numeric", month: "2-digit", day: "2-digit" }
            : {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              },
        ),
      ),
    [value, dateOnly],
  );
  return <time dateTime={value}>{label}</time>;
}
