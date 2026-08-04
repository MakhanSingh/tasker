import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Marks the field as required with a red asterisk. */
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label ref={ref} className={cn("text-[13px] font-medium text-ink-secondary", className)} {...props}>
      {children}
      {required && (
        // aria-hidden because the input itself carries `required`, which is
        // what a screen reader announces; this asterisk is for the eye only,
        // and reading it out would just say "asterisk" twice over.
        <span aria-hidden className="ml-0.5 text-accent">
          *
        </span>
      )}
    </label>
  )
);
Label.displayName = "Label";
