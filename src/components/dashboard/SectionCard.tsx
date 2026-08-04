import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// Card with a titled header and an optional "View all" link. Rows inside run
// edge-to-edge, so the body carries no padding of its own.
export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-[10px] border border-border bg-white", className)}>
      <header className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {action && (
          <Link href={action.href} className="text-[13px] font-medium text-ink-muted hover:text-accent">
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-[13px] text-ink-muted">{children}</p>;
}
