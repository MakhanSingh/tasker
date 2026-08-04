// Purely presentational — label on its own line, control/value below it,
// a hairline under each row. Used by every field in the task detail
// sidebar, so the rows line up identically whether they're editable
// controls or read-only text.
export function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border-soft py-3 first:pt-0 last:border-0">
      <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
      <div className="flex min-h-8 items-center gap-2">{children}</div>
    </div>
  );
}
