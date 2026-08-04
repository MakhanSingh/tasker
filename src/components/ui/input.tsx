import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-[5px] border border-border bg-white px-3 py-1 text-sm text-ink transition-colors placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-ink-faint focus-visible:ring-1 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
        // A rejected field reads as rejected at a glance, not only from the
        // sentence under it — colour finds the field, the text explains it.
        "aria-invalid:border-accent aria-invalid:focus-visible:border-accent aria-invalid:focus-visible:ring-accent/40",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
