import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Gauge, History } from "lucide-react";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { getRunningTimer } from "@/lib/time/getRunningTimer";
import { StatTile } from "@/components/dashboard/StatTile";
import { WeeklyTimesheet, type TimesheetRow } from "@/components/time/WeeklyTimesheet";
import { formatMinutes } from "@/lib/utils/time";
import { formatMoney } from "@/lib/utils/money";
import { toDateKey, todayKey } from "@/lib/todo/buckets";
import {
  entryDateKey,
  formatHoursMinutes,
  formatWeekRange,
  parseWeek,
  shiftWeek,
  startOfWeek,
  weekDays,
  weekParam,
  weekdayName,
} from "@/lib/time/week";

// Phase 1 bills in a single currency.
const CURRENCY = "USD";

/**
 * Your own week, as a timesheet: a row per project, a column per day.
 *
 * Rates come from `project_billing`, which team members have no policy on at
 * all — their query returns nothing, every row's rate is null, and the Rate
 * and Amount columns simply aren't rendered. The confidentiality rule is the
 * database's, not this page's.
 */
export default async function MyTimePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "client") redirect("/");

  const { week } = await searchParams;
  const selectedWeek = parseWeek(week);
  const days = weekDays(selectedWeek).map(toDateKey);
  const daySet = new Set(days);
  const isThisWeek = toDateKey(selectedWeek) === toDateKey(startOfWeek(new Date()));

  const supabase = await createClient();
  const [{ data: entries }, runningTimer] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*, projects(name, client_id)")
      .eq("user_id", profile.id)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false }),
    getRunningTimer(profile.id),
  ]);

  const rows = entries ?? [];
  const weekEntries = rows.filter((entry) => daySet.has(entryDateKey(entry.started_at)));

  const projectIds = [...new Set(weekEntries.map((e) => e.project_id))];
  const [{ data: billing }, { data: clients }, { data: tasks }] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("project_billing").select("project_id, hourly_rate").in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    supabase.from("clients").select("id, name"),
    supabase.from("tasks").select("id, title"),
  ]);

  const rateByProject = new Map(
    (billing ?? []).map((b) => [b.project_id, b.hourly_rate === null ? null : Number(b.hourly_rate)])
  );
  const clientNames = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const taskTitles = new Map((tasks ?? []).map((t) => [t.id, t.title]));

  // One row per project, minutes bucketed by the day they were worked.
  const byProject = new Map<string, TimesheetRow>();
  for (const entry of weekEntries) {
    const key = entry.project_id;
    if (!byProject.has(key)) {
      byProject.set(key, {
        projectId: key,
        projectName: entry.projects?.name ?? "Project",
        clientName: entry.projects?.client_id ? (clientNames.get(entry.projects.client_id) ?? null) : null,
        minutesByDay: new Map(),
        totalMinutes: 0,
        hourlyRate: rateByProject.get(key) ?? null,
      });
    }
    const row = byProject.get(key)!;
    const day = entryDateKey(entry.started_at);
    const minutes = entry.duration_minutes ?? 0;
    row.minutesByDay.set(day, (row.minutesByDay.get(day) ?? 0) + minutes);
    row.totalMinutes += minutes;
  }

  const timesheetRows = [...byProject.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);

  const sum = (list: typeof rows) => list.reduce((total, e) => total + (e.duration_minutes ?? 0), 0);
  const weekMinutes = sum(weekEntries);
  const lastWeekKeys = new Set(weekDays(shiftWeek(selectedWeek, -1)).map(toDateKey));
  const lastWeekMinutes = sum(rows.filter((e) => lastWeekKeys.has(entryDateKey(e.started_at))));

  // Averaged over the days actually worked, not over seven — a four-day week
  // shouldn't read as a slow one.
  const daysWorked = new Set(weekEntries.map((e) => entryDateKey(e.started_at))).size;
  const dailyAverage = daysWorked > 0 ? Math.round(weekMinutes / daysWorked) : 0;

  const weekValue = timesheetRows.reduce(
    (total, row) => total + (row.hourlyRate ? (row.totalMinutes / 60) * row.hourlyRate : 0),
    0
  );
  const showMoney = timesheetRows.some((row) => row.hourlyRate !== null);

  const today = todayKey();
  const entriesByDay = new Map<string, typeof weekEntries>();
  for (const entry of weekEntries) {
    const day = entryDateKey(entry.started_at);
    entriesByDay.set(day, [...(entriesByDay.get(day) ?? []), entry]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Timesheet for {formatWeekRange(selectedWeek)}
            {isThisWeek && <span className="text-ink-muted"> · this week</span>}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {daysWorked === 0
              ? "No hours logged yet"
              : `${formatHoursMinutes(weekMinutes)} hrs across ${daysWorked} ${daysWorked === 1 ? "day" : "days"}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href={`/time?week=${weekParam(shiftWeek(selectedWeek, -1))}`}
            aria-label="Previous week"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`/time?week=${weekParam(shiftWeek(selectedWeek, 1))}`}
            aria-label="Next week"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          {!isThisWeek && (
            <Link
              href="/time"
              className="ml-1 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium text-ink-secondary hover:bg-hover hover:text-ink"
            >
              This week
            </Link>
          )}
        </div>
      </div>

      {runningTimer && (
        <div className="flex items-center gap-2 rounded-[10px] border border-success-border bg-success-bg px-4 py-3">
          <Clock className="h-4 w-4 shrink-0 text-success" />
          <span className="text-[14px] text-success">
            Timer running on{" "}
            <Link
              href={`/projects/${runningTimer.project_id}/time`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {runningTimer.projects?.name ?? "a project"}
            </Link>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="This week" value={formatMinutes(weekMinutes)} icon={CalendarDays} tone="primary" />
        <StatTile label="Week before" value={formatMinutes(lastWeekMinutes)} icon={History} tone="neutral" />
        <StatTile
          label="Daily average"
          value={formatMinutes(dailyAverage)}
          hint={daysWorked > 0 ? `over ${daysWorked} ${daysWorked === 1 ? "day" : "days"} worked` : undefined}
          icon={Gauge}
          tone="neutral"
        />
        {showMoney && (
          <StatTile
            label="Value this week"
            value={formatMoney(weekValue, CURRENCY)}
            icon={Clock}
            tone="success"
          />
        )}
      </div>

      <WeeklyTimesheet days={days} rows={timesheetRows} currency={CURRENCY} />

      {weekEntries.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-ink">What you worked on</h2>
          <div className="flex flex-col gap-3">
            {days
              .filter((day) => entriesByDay.has(day))
              .map((day) => {
                const date = new Date(`${day}T00:00:00`);
                const dayEntries = entriesByDay.get(day)!;
                return (
                  <div key={day} className="overflow-hidden rounded-[10px] border border-border bg-white">
                    <div className="flex items-baseline justify-between border-b border-border-soft px-4 py-2.5">
                      <span className="text-[13px] font-medium text-ink">
                        {date.getDate()} {weekdayName(date)}
                        {day === today && <span className="text-accent"> · today</span>}
                      </span>
                      <span className="text-[13px] tabular-nums text-ink-muted">
                        {formatHoursMinutes(sum(dayEntries))} hrs
                      </span>
                    </div>
                    <ul className="flex flex-col">
                      {dayEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-center gap-3 border-b border-border-soft px-4 py-2.5 text-[13px] last:border-0"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink">
                            {entry.task_id ? (taskTitles.get(entry.task_id) ?? "Task") : "General project work"}
                            {entry.description && (
                              <span className="text-ink-muted"> — {entry.description}</span>
                            )}
                          </span>
                          <span className="shrink-0 truncate text-[12px] text-ink-faint">
                            {entry.projects?.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-ink">
                            {formatHoursMinutes(entry.duration_minutes ?? 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
