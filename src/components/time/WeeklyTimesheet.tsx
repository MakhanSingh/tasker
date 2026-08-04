import Link from "next/link";
import { formatHoursMinutes, weekdayName } from "@/lib/time/week";
import { formatMoney } from "@/lib/utils/money";
import { todayKey } from "@/lib/todo/buckets";
import { cn } from "@/lib/utils/cn";

export type TimesheetRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  /** Minutes per YYYY-MM-DD. Days with nothing logged are simply absent. */
  minutesByDay: Map<string, number>;
  totalMinutes: number;
  /** null when the reader may not see rates — see the page for why. */
  hourlyRate: number | null;
};

/**
 * The week as a grid: a row per project, a column per day.
 *
 * Rate and Amount appear only when `hourlyRate` is set, which happens only
 * for readers whose query against `project_billing` returned something.
 * A team member's comes back empty (migration 0012 gives them no policy
 * there), so those columns disappear for them without a role check here.
 */
export function WeeklyTimesheet({
  days,
  rows,
  currency,
}: {
  days: string[];
  rows: TimesheetRow[];
  currency: string;
}) {
  const today = todayKey();
  const showMoney = rows.some((row) => row.hourlyRate !== null);

  const dayTotals = days.map((day) => rows.reduce((sum, row) => sum + (row.minutesByDay.get(day) ?? 0), 0));
  const weekTotal = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const weekAmount = rows.reduce(
    (sum, row) => sum + (row.hourlyRate ? (row.totalMinutes / 60) * row.hourlyRate : 0),
    0
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-white p-8 text-center">
        <p className="text-[14px] text-ink">Nothing logged this week.</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Start a timer from any task, or add hours from a project&apos;s Time tab.
        </p>
      </div>
    );
  }

  return (
    // The grid scrolls on its own rather than pushing the page sideways.
    <div className="overflow-x-auto rounded-[10px] border border-border bg-white">
      <table className="w-full min-w-[720px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-[13px] font-medium text-ink-secondary">Project</th>
            {days.map((day) => {
              const date = new Date(`${day}T00:00:00`);
              return (
                <th
                  key={day}
                  className={cn(
                    "px-2 py-3 text-center text-[13px] font-medium",
                    day === today ? "bg-selected text-accent" : "text-ink-secondary",
                    // Days that haven't happened yet are visibly inert.
                    day > today && "text-ink-faint"
                  )}
                >
                  <span className="block">{weekdayName(date).slice(0, 3)}</span>
                  <span className="block font-normal">
                    {date.getDate()}/{date.getMonth() + 1}
                  </span>
                </th>
              );
            })}
            <th className="px-3 py-3 text-right text-[13px] font-medium text-ink-secondary">Hours</th>
            {showMoney && (
              <>
                <th className="px-3 py-3 text-right text-[13px] font-medium text-ink-secondary">Rate</th>
                <th className="px-4 py-3 text-right text-[13px] font-medium text-ink-secondary">Amount</th>
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.projectId} className="border-b border-border-soft last:border-0 hover:bg-hover-soft">
              <td className="px-4 py-3">
                <Link href={`/projects/${row.projectId}/time`} className="flex min-w-0 flex-col">
                  <span className="truncate text-ink hover:underline">{row.projectName}</span>
                  {row.clientName && (
                    <span className="truncate text-[12px] text-ink-faint">{row.clientName}</span>
                  )}
                </Link>
              </td>

              {days.map((day) => {
                const minutes = row.minutesByDay.get(day) ?? 0;
                return (
                  <td
                    key={day}
                    className={cn(
                      "px-2 py-3 text-center tabular-nums",
                      day === today && "bg-selected",
                      minutes > 0 ? "text-ink" : "text-ink-faint"
                    )}
                  >
                    {minutes > 0 ? formatHoursMinutes(minutes) : "—"}
                  </td>
                );
              })}

              <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">
                {formatHoursMinutes(row.totalMinutes)}
              </td>
              {showMoney && (
                <>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
                    {row.hourlyRate ? `${formatMoney(row.hourlyRate, currency)}/hr` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">
                    {row.hourlyRate
                      ? formatMoney((row.totalMinutes / 60) * row.hourlyRate, currency)
                      : "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-border bg-sidebar">
            <td className="px-4 py-3 text-[13px] font-medium text-ink-secondary">Total</td>
            {days.map((day, index) => (
              <td
                key={day}
                className={cn(
                  "px-2 py-3 text-center font-medium tabular-nums",
                  day === today && "bg-selected",
                  dayTotals[index] > 0 ? "text-ink" : "text-ink-faint"
                )}
              >
                {dayTotals[index] > 0 ? formatHoursMinutes(dayTotals[index]) : "—"}
              </td>
            ))}
            <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">
              {formatHoursMinutes(weekTotal)}
            </td>
            {showMoney && (
              <>
                <td />
                <td className="px-4 py-3 text-right font-bold tabular-nums text-ink">
                  {formatMoney(weekAmount, currency)}
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
