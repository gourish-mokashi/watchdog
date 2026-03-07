import { cn } from "@/lib/utils";
import * as React from "react";

function Item({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "muted";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius,0.75rem)] px-3 py-2",
        variant === "muted" && "bg-zinc-100 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

function ItemMedia({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", className)}
      {...props}
    />
  );
}

function ItemContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col justify-center", className)}
      {...props}
    />
  );
}

function ItemTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-sm font-medium text-zinc-900 dark:text-zinc-100",
        className,
      )}
      {...props}
    />
  );
}

export { Item, ItemContent, ItemMedia, ItemTitle };
