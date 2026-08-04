import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Muted, low-chrome chips — Todoist keeps colour for dates and the brand
// red, so status pills stay quiet and never compete with the task text.
const badgeVariants = cva("inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[12px] font-medium", {
  variants: {
    variant: {
      default: "bg-hover text-ink-secondary",
      success: "bg-success-bg text-success",
      warning: "bg-warning-bg text-warning",
      danger: "bg-danger-bg text-danger",
      info: "bg-info-bg text-info",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
