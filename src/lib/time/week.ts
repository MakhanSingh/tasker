import { toDateKey } from "@/lib/todo/buckets";

// Fixed labels rather than toLocaleDateString — the server's locale must not
// decide what the diary says, or server and client markup diverge.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Monday of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** `?week=YYYY-MM-DD` → that date's Monday; anything else → this week. */
export function parseWeek(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return startOfWeek(parsed);
  }
  return startOfWeek(new Date());
}

export function weekParam(monday: Date): string {
  return toDateKey(monday);
}

export function shiftWeek(monday: Date, weeks: number): Date {
  const shifted = new Date(monday);
  shifted.setDate(shifted.getDate() + weeks * 7);
  return shifted;
}

/** The seven dates of the week, Monday first. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

/** "Jul 20 - Jul 26", or "Jun 29 - Jul 5" when the week straddles months. */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} - ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`;
}

export function weekdayName(date: Date): string {
  return WEEKDAYS_LONG[(date.getDay() + 6) % 7];
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_SHORT[month]} ${year}`;
}

/**
 * Which local day a time entry belongs to. Manual entries are stored at noon
 * UTC precisely so this lands on the intended day everywhere.
 */
export function entryDateKey(startedAt: string): string {
  return toDateKey(new Date(startedAt));
}

/** Hours as "20:00", the timesheet convention, rather than "20h 0m". */
export function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
