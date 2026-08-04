import { formatMinutes } from "@/lib/utils/time";

/**
 * The shell of the task sidebar's time panel: a label, the total, whatever
 * controls the reader is allowed, then the rows behind the number.
 *
 * Purely presentational, because the two callers legitimately read different
 * tables — the team reads `time_entries`, a client reads the grouped
 * `project_hours_summary` view, since RLS gives them no access to the raw
 * entries at all. Only the query differs; this keeps the panel itself from
 * being written twice and drifting.
 */
export function TaskTimePanel({
  label,
  totalMinutes,
  controls,
  children,
  emptyMessage,
}: {
  label: string;
  totalMinutes: number;
  /** Timer and Add-time, for whoever may log time. */
  controls?: React.ReactNode;
  /** The rows; falsy when there are none. */
  children?: React.ReactNode;
  emptyMessage?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border-soft py-3 last:border-0">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
        <span className="text-[20px] font-semibold text-ink">{formatMinutes(totalMinutes)}</span>
      </div>

      {controls}

      {children ? (
        <div className="flex flex-col divide-y divide-border-soft border-t border-border-soft pt-1">
          {children}
        </div>
      ) : (
        emptyMessage && <p className="text-[12px] text-ink-faint">{emptyMessage}</p>
      )}
    </div>
  );
}
