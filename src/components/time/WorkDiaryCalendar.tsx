import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateKey, todayKey } from "@/lib/todo/buckets";
import { monthLabel, weekDays, weekParam } from "@/lib/time/week";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];



/** Weeks start Monday; the grid is padded to whole weeks so rows are square. */
function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));

  const cells: Array<{ date: Date; key: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({ date, key: toDateKey(date), inMonth: date.getMonth() === month });
    if (i >= 27 && (i + 1) % 7 === 0) {
      const next = new Date(start);
      next.setDate(start.getDate() + i + 1);
      if (next.getMonth() !== month) break;
    }
  }
  return cells;
}

// The diary's date picker: a month at a glance, with a marker under any day
// that has hours. Picking any day selects the whole week that contains it —
// the week is the unit the diary reports on, so selecting a single day would
// promise a view that doesn't exist.
export function WorkDiaryCalendar({
  basePath,
  year,
  month,
  minutesByDate,
  selectedWeek,
}: {
  basePath: string;
  year: number;
  month: number;
  /** Minutes logged per YYYY-MM-DD, for the day markers. */
  minutesByDate: Map<string, number>;
  /** Monday of the week the diary is showing. */
  selectedWeek: Date;
}) {
  const today = todayKey();
  const cells = buildGrid(year, month);
  const selectedWeekKeys = new Set(weekDays(selectedWeek).map(toDateKey));

  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

  // Paging the calendar keeps the selected week; it only changes which month
  // is on show, so a glance at last month doesn't wipe the diary beside it.
  const monthHref = (y: number, m: number) =>
    `${basePath}?month=${y}-${String(m + 1).padStart(2, "0")}&week=${weekParam(selectedWeek)}`;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <Link
          href={monthHref(prev.year, prev.month)}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-[15px] font-bold text-ink">{monthLabel(year, month)}</span>
        <Link
          href={monthHref(next.year, next.month)}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-center text-[11px] font-medium text-ink-muted">
            {day}
          </span>
        ))}

        {cells.map((cell) => {
          const minutes = minutesByDate.get(cell.key) ?? 0;
          const isToday = cell.key === today;
          const inWeek = selectedWeekKeys.has(cell.key);

          return (
            <Link
              key={cell.key}
              href={`${basePath}?month=${year}-${String(month + 1).padStart(2, "0")}&week=${cell.key}`}
              aria-label={`Week of ${cell.key}`}
              className={cn(
                "flex h-9 flex-col items-center justify-center gap-0.5 text-[13px] transition-colors",
                inWeek ? "bg-hover" : "hover:bg-hover-soft",
                // Only the ends of the selected week get rounded, so the row
                // reads as one continuous band.
                inWeek && cell.date.getDay() === 1 && "rounded-l-full",
                inWeek && cell.date.getDay() === 0 && "rounded-r-full",
                cell.inMonth ? "text-ink" : "text-ink-faint",
                isToday && "font-bold text-accent"
              )}
            >
              <span className="leading-none">{cell.date.getDate()}</span>
              <span className="flex h-1 items-center">
                {minutes > 0 && <span className="h-1 w-1 rounded-full bg-success" aria-hidden />}
              </span>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
