"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatHoursMinutes, weekdayName } from "@/lib/time/week";
import { todayKey } from "@/lib/todo/buckets";
import { cn } from "@/lib/utils/cn";

export type DiaryEntry = {
  id: string;
  dateKey: string;
  minutes: number;
  description: string | null;
  taskTitle: string | null;
  personName: string | null;
};

// The week laid out a day per row, each with a bar in proportion to the
// busiest day; a day with hours expands to the entries behind it.
//
// Hours are hours — whether they came off the timer or were typed in for a
// past date is not a distinction anyone reading this needs, so the bar is one
// colour and there is no legend.
export function WorkDiaryWeek({ days, entries }: { days: string[]; entries: DiaryEntry[] }) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const today = todayKey();

  const byDay = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    byDay.set(entry.dateKey, [...(byDay.get(entry.dateKey) ?? []), entry]);
  }

  const totalFor = (dayEntries: DiaryEntry[]) => dayEntries.reduce((sum, e) => sum + e.minutes, 0);

  // Scaled to the busiest day, but never to less than an 8-hour reference —
  // otherwise a single 20-minute day would render as a full bar.
  const busiest = Math.max(480, ...days.map((day) => totalFor(byDay.get(day) ?? [])));

  return (
    <div className="flex flex-col">
      {days.map((day) => {
        const dayEntries = byDay.get(day) ?? [];
        const total = totalFor(dayEntries);
        const date = new Date(`${day}T00:00:00`);
        const isOpen = openDay === day;
        const isToday = day === today;

        return (
          <div key={day} className="border-b border-border-soft last:border-0">
            <button
              type="button"
              disabled={total === 0}
              onClick={() => setOpenDay(isOpen ? null : day)}
              // The visible row is a date, a bar and a number; without this
              // the control reaches a screen reader as an unnamed button.
              aria-label={`${date.getDate()} ${weekdayName(date)}, ${formatHoursMinutes(total)} hrs`}
              aria-expanded={total > 0 ? isOpen : undefined}
              className={cn(
                "flex w-full items-center gap-4 px-1 py-3 text-left transition-colors",
                total > 0 ? "hover:bg-hover-soft" : "cursor-default"
              )}
            >
              <span className="w-32 shrink-0">
                <span className={cn("text-[14px]", isToday ? "font-bold text-accent" : "text-ink")}>
                  {date.getDate()} {weekdayName(date)}
                </span>
              </span>

              <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden>
                {total > 0 && (
                  <span className="h-full bg-success" style={{ width: `${(total / busiest) * 100}%` }} />
                )}
              </span>

              <span
                className={cn(
                  "w-20 shrink-0 text-right text-[14px] tabular-nums",
                  total > 0 ? "font-medium text-ink" : "text-ink-faint"
                )}
              >
                {formatHoursMinutes(total)} hrs
              </span>

              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-ink-faint transition-transform",
                  total === 0 && "invisible",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {isOpen && (
              <ul className="flex flex-col gap-1 pb-3 pl-1 pr-9">
                {dayEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-[6px] bg-hover-soft px-3 py-2 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {entry.taskTitle ?? "General project work"}
                      {entry.description && <span className="text-ink-muted"> — {entry.description}</span>}
                    </span>
                    {entry.personName && (
                      <span className="shrink-0 text-[12px] text-ink-faint">{entry.personName}</span>
                    )}
                    <span className="shrink-0 tabular-nums text-ink">{formatHoursMinutes(entry.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
