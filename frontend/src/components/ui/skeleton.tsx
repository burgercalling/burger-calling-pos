import type { HTMLAttributes } from "react";

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-stone-200/80 dark:bg-stone-800/80 ${className}`}
      {...props}
    />
  );
}
