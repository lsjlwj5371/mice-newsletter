import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "active"
  | "unsubscribed"
  | "pending"
  | "bounced"
  | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-muted text-foreground border-border",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unsubscribed: "bg-zinc-100 text-zinc-600 border-zinc-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  bounced: "bg-rose-50 text-rose-700 border-rose-200",
  muted: "bg-muted text-muted-foreground border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
