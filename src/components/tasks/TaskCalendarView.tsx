import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateKey, todayKey } from "@/lib/todo/buckets";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

// Fixed labels rather than toLocaleDateString — the server's locale must not
// decide what the grid says, or server and client markup diverge.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PRIORITY_CHIP = {
  low: "bg-hover text-ink-secondary",
  medium: "bg-info-bg text-info",
  high: "bg-warning-bg text-warning",
  urgent: "bg-danger-bg text-danger",
} as const;

/** `YYYY-MM`, falling back to the current month when absent or malformed. */
export function parseMonth(value: string | undefined): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month: month - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Weeks start Monday, and the grid is padded out to whole weeks so every row
// has seven cells.
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

export function TaskCalendarView({
  projectId,
  tasks,
  year,
  month,
}: {
  projectId: string;
  tasks: Task[];
  year: number;
  month: number;
}) {
  const today = todayKey();
  const cells = buildGrid(year, month);

  const byDate = new Map<string, Task[]>();
  const undated: Task[] = [];
  for (const task of tasks) {
    if (!task.due_date) {
      undated.push(task);
      continue;
    }
    const key = task.due_date.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), task]);
  }

  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const base = `/projects/${projectId}/tasks?view=calendar`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={`${base}&month=${monthParam(prev.year, prev.month)}`}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={base}
            className="rounded-[5px] px-2 py-1 text-[13px] font-medium text-ink-secondary hover:bg-hover hover:text-ink"
          >
            Today
          </Link>
          <Link
            href={`${base}&month=${monthParam(next.year, next.month)}`}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-white">
        <div className="grid grid-cols-7 border-b border-border-soft">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[12px] font-medium text-ink-muted">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayTasks = byDate.get(cell.key) ?? [];
            const isToday = cell.key === today;

            return (
              <div
                key={cell.key}
                className={cn(
                  "min-h-[104px] border-b border-r border-border-soft p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  !cell.inMonth && "bg-hover-soft"
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px]",
                      isToday
                        ? "bg-primary font-semibold text-white"
                        : cell.inMonth
                          ? "text-ink-secondary"
                          : "text-ink-faint"
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      href={`/projects/${projectId}/tasks/${task.id}`}
                      title={task.title}
                      className={cn(
                        "truncate rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium hover:brightness-95",
                        PRIORITY_CHIP[task.priority],
                        task.status === "done" && "line-through opacity-60"
                      )}
                    >
                      {task.title}
                    </Link>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="px-1.5 text-[11px] text-ink-faint">+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-[10px] border border-border bg-white p-4">
          <p className="mb-2 text-[13px] font-medium text-ink-secondary">
            No due date <span className="font-normal text-ink-faint">({undated.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((task) => (
              <Link
                key={task.id}
                href={`/projects/${projectId}/tasks/${task.id}`}
                className={cn(
                  "rounded-[4px] px-2 py-1 text-[12px] font-medium hover:brightness-95",
                  PRIORITY_CHIP[task.priority],
                  task.status === "done" && "line-through opacity-60"
                )}
              >
                {task.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
