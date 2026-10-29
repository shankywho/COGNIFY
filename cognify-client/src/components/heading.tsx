import * as React from "react";
import { cn } from "@/lib/utils";

export const Heading = ({
  children,
  className,
  as: Component = "h1",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) => {
  return (
    <Component
      className={cn(
        "text-center text-3xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl leading-[1.08] text-balance",
        className,
      )}
    >
      {children}
    </Component>
  );
};
