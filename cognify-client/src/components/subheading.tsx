import * as React from "react";
import { cn } from "@/lib/utils";

export const SubHeading = ({
  children,
  className,
  as: Component = "p",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) => {
  return (
    <Component
      className={cn(
        "text-center text-sm font-normal text-zinc-400 md:text-base lg:text-lg leading-relaxed text-pretty",
        className,
      )}
    >
      {children}
    </Component>
  );
};
