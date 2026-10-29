import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps<T extends React.ElementType = "button"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "brand";
  size?: "sm" | "md" | "lg";
  className?: string;
  as?: T;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
}

export const Button = <T extends React.ElementType = "button">({
  children,
  variant = "primary",
  size = "md",
  className,
  as,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps<T> &
  Omit<
    React.ComponentProps<T>,
    "children" | "variant" | "size" | "className" | "as" | "disabled"
  > &
  (T extends "a" ? { href: string } : {})) => {
  const Component = as || "button";

  const sizeClasses = {
    sm: "h-8 px-3.5 text-xs gap-1.5 rounded-lg",
    md: "h-10 px-5 text-sm gap-2 rounded-lg",
    lg: "h-12 px-7 text-[15px] gap-2.5 rounded-xl font-medium",
  };

  const variantClasses = {
    primary:
      "bg-white !text-black hover:bg-zinc-200 border border-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.15)] font-semibold active:scale-[0.98]",
    secondary:
      "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white border border-zinc-800 shadow-sm font-medium active:scale-[0.98]",
    outline:
      "border border-zinc-800 hover:border-zinc-700 bg-transparent text-zinc-200 hover:text-white hover:bg-zinc-900/60 font-medium active:scale-[0.98]",
    ghost:
      "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/60 font-medium active:scale-[0.98]",
    brand:
      "bg-white !text-black hover:bg-zinc-200 border border-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.2)] font-semibold active:scale-[0.98]",
  };

  const isPrimary = variant === "primary" || variant === "brand";

  const primaryStyle: React.CSSProperties = isPrimary
    ? {
        backgroundColor: "#ffffff",
        color: "#000000",
      }
    : {};

  return (
    <Component
      {...props}
      data-variant={variant}
      disabled={disabled}
      style={{
        ...primaryStyle,
        ...(props as any).style,
      }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap select-none font-sans tracking-tight transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {leftIcon && (
        <span
          className="shrink-0"
          style={isPrimary ? { color: "#000000" } : undefined}
        >
          {leftIcon}
        </span>
      )}
      <span
        style={isPrimary ? { color: "#000000", fontWeight: 600 } : undefined}
        className={cn(isPrimary ? "!text-black font-semibold" : undefined, "inline-flex items-center")}
      >
        {children}
      </span>
      {rightIcon && (
        <span
          className="shrink-0"
          style={isPrimary ? { color: "#000000" } : undefined}
        >
          {rightIcon}
        </span>
      )}
    </Component>
  );
};
