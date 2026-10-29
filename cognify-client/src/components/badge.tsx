import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps {
  text: string;
  pill?: string;
  className?: string;
}

export const Badge = ({ text, pill = "v2.0", className }: BadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur-md transition-colors hover:border-zinc-700",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-white">
        <span className="size-1.5 rounded-full bg-white animate-pulse" />
        {pill}
      </span>
      <span className="h-3 w-px bg-zinc-800" />
      <span className="text-zinc-400 font-medium">{text}</span>
    </div>
  );
};
