import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

// Tinted icon square + label + value. Reads as a compact tile rather than a
// mostly-empty bordered box, which is what a bare number in a Card looks like.
const TONE_ICON: Record<Tone, string> = {
  neutral: "bg-hover text-ink-secondary",
  primary: "bg-selected text-primary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]", TONE_ICON[tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-ink-muted">{label}</span>
        <span className="text-[22px] font-bold leading-tight text-ink">{value}</span>
        {hint && <span className="truncate text-[12px] text-ink-faint">{hint}</span>}
      </span>
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-[10px] border border-border bg-white p-4",
    href && "transition-colors hover:bg-hover-soft"
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
