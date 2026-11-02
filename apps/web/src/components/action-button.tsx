"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title">;
type ButtonProps = ActionProps & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

// Keep the shared kit styling without its automatic aria-label tooltips.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      type = "button",
      className = "",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`desktop-button desktop-button--${variant} desktop-button--${size} ${className}`}
        {...props}
      />
    );
  },
);

export const IconButton = forwardRef<HTMLButtonElement, ActionProps>(
  function IconButton({ type = "button", className = "", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={`desktop-icon-control ${className}`}
        {...props}
      />
    );
  },
);
