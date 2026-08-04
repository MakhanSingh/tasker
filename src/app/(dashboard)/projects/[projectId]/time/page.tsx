import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/StatTile";
import { AddProjectTimeDialog } from "@/components/time/AddProjectTimeDialog";
import { ProjectPayments } from "@/components/time/ProjectPayments";
import { MilestoneManager } from "@/components/projects/MilestoneManager";
import { WorkDiaryCalendar } from "@/components/time/WorkDiaryCalendar";
import { WorkDiaryWeek, type DiaryEntry } from "@/components/time/WorkDiaryWeek";
import { parseMonth } from "@/components/tasks/TaskCalendarView";
import { getProjectBilling } from "@/lib/projects/billing";
import { formatMinutes } from "@/lib/utils/time";
import { toDateKey } from "@/lib/todo/buckets";
import {
  entryDateKey,
  formatHoursMinutes,
  formatWeekRange,
  parseWeek,
  shiftWeek,
  startOfWeek,
  weekDays,
  weekParam,
} from "@/lib/time/week";

type SearchParams = Promise<{ week?: string; month?: string }>;

function sumMinutes(rows: Array<{ duration_minutes: number | null }>) {
  return rows.reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0);
}

// The project's timesheet, laid out like a work diary: a month picker beside
// the selected week, that week broken down day by day, and — for whoever is
// allowed to see money — the payment position above it.
//
// A team member gets hours and nothing else. That isn't decided here: their
// query against project_billing returns nothing, because the table has no
// policy for them at all (migration 0012).
export default async function ProjectTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: SearchParams;
}) {
  const { projectId } = await params;
  const { week, month: monthParam } = await searchParams;
  const role = await getProjectRole(projectId);
  const supabase = await createClient();

  const selectedWeek = parseWeek(week);
  const days = weekDays(selectedWeek).map(toDateKey);
  const daySet = new Set(days);
  const basePath = `/projects/${projectId}/time`;

  // The calendar defaults to the selected week's month, not today's, so
  // arriving on a linked week doesn't show a month that week isn't in.
  const { year, month } = parseMonth(
    monthParam ?? `${selectedWeek.getFullYear()}-${String(selectedWeek.getMonth() + 1).padStart(2, "0")}`
  );

  const billing = await getProjectBilling(projectId);

  // ---------------------------------------------------------------------
  // Client view — RLS gives clients no policy on time_entries at all, so
  // they read the grouped rollup instead: hours to look at, never to edit.
  // ---------------------------------------------------------------------
  if (role === "client") {
    const { data: summary } = await supabase
      .from("project_hours_summary")
      .select("*")
      .eq("project_id", projectId);

    const rows = summary ?? [];
    const minutesByDate = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.work_date).slice(0, 10);
      minutesByDate.set(key, (minutesByDate.get(key) ?? 0) + Number(row.total_minutes));
    }

    const weekEntries: DiaryEntry[] = rows
      .filter((row) => daySet.has(String(row.work_date).slice(0, 10)))
      .map((row, index) => ({
        id: `${row.work_date}-${row.task_id ?? "none"}-${index}`,
        dateKey: String(row.work_date).slice(0, 10),
        minutes: Number(row.total_minutes),
        description: null,
        taskTitle: null,
        personName: null,
      }));

    const totalMinutes = rows.reduce((sum, row) => sum + Number(row.total_minutes), 0);
    const weekMinutes = weekEntries.reduce((sum, e) => sum + e.minutes, 0);

    return (
      <div className="flex flex-col gap-8">
        {billing && (
          <ProjectPayments billing={billing} totalMinutes={totalMinutes} uninvoicedMinutes={null} />
        )}

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile label="Hours this week" value={formatMinutes(weekMinutes)} icon={CalendarDays} tone="primary" />
            <StatTile label="Hours since start" value={formatMinutes(totalMinutes)} icon={Clock} tone="success" />
          </div>

          <WorkDiary
            basePath={basePath}
            selectedWeek={selectedWeek}
            days={days}
            year={year}
            month={month}
            minutesByDate={minutesByDate}
            entries={weekEntries}
            weekMinutes={weekMinutes}
            addTime={null}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Admin and team members — the same diary. `billing` is null for members.
  // ---------------------------------------------------------------------
  const [{ data: entries }, { data: tasks }] = await Promise.all([
    supabase.from("time_entries").select("*").eq("project_id", projectId).not("ended_at", "is", null),
    supabase.from("tasks").select("id, title").eq("project_id", projectId).order("title"),
  ]);

  const rows = entries ?? [];
  const taskTitles = new Map((tasks ?? []).map((t) => [t.id, t.title]));

  const userIds = [...new Set(rows.map((e) => e.user_id))];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    (profiles ?? []).forEach((p) => userNames.set(p.id, p.full_name));
  }

  const minutesByDate = new Map<string, number>();
  for (const entry of rows) {
    const key = entryDateKey(entry.started_at);
    minutesByDate.set(key, (minutesByDate.get(key) ?? 0) + (entry.duration_minutes ?? 0));
  }

  const weekEntries: DiaryEntry[] = rows
    .filter((entry) => daySet.has(entryDateKey(entry.started_at)))
    .map((entry) => ({
      id: entry.id,
      dateKey: entryDateKey(entry.started_at),
      minutes: entry.duration_minutes ?? 0,
      description: entry.description,
      taskTitle: entry.task_id ? (taskTitles.get(entry.task_id) ?? "Task") : null,
      personName: userNames.get(entry.user_id) ?? null,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = sumMinutes(rows);
  const weekMinutes = weekEntries.reduce((sum, e) => sum + e.minutes, 0);
  const thisWeekKeys = new Set(weekDays(startOfWeek(new Date())).map(toDateKey));
  const lastWeekKeys = new Set(weekDays(shiftWeek(startOfWeek(new Date()), -1)).map(toDateKey));
  const thisWeekMinutes = sumMinutes(rows.filter((e) => thisWeekKeys.has(entryDateKey(e.started_at))));
  const lastWeekMinutes = sumMinutes(rows.filter((e) => lastWeekKeys.has(entryDateKey(e.started_at))));
  // Counted the way the invoice generator picks entries up, or the two
  // numbers would disagree.
  const uninvoicedMinutes = sumMinutes(rows.filter((e) => e.is_billable && e.invoice_line_item_id === null));

  const byTask = new Map<string, number>();
  const byPerson = new Map<string, number>();
  for (const entry of rows) {
    const minutes = entry.duration_minutes ?? 0;
    byTask.set(entry.task_id ?? "none", (byTask.get(entry.task_id ?? "none") ?? 0) + minutes);
    byPerson.set(entry.user_id, (byPerson.get(entry.user_id) ?? 0) + minutes);
  }

  return (
    <div className="flex flex-col gap-8">
      {billing && (
        <ProjectPayments
          billing={billing}
          totalMinutes={totalMinutes}
          uninvoicedMinutes={uninvoicedMinutes}
          manageMilestones={
            role === "admin" && billing.billingType === "fixed" ? (
              <MilestoneManager projectId={projectId} milestones={billing.milestones} />
            ) : null
          }
        />
      )}

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="This week" value={formatMinutes(thisWeekMinutes)} icon={CalendarDays} tone="primary" />
          <StatTile label="Last week" value={formatMinutes(lastWeekMinutes)} icon={History} tone="neutral" />
          <StatTile label="Since start" value={formatMinutes(totalMinutes)} icon={Clock} tone="success" />
        </div>

        <WorkDiary
          basePath={basePath}
          selectedWeek={selectedWeek}
          days={days}
          year={year}
          month={month}
          minutesByDate={minutesByDate}
          entries={weekEntries}
          weekMinutes={weekMinutes}
          addTime={<AddProjectTimeDialog projectId={projectId} tasks={tasks ?? []} />}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By task</CardTitle>
              <p className="text-[13px] text-ink-muted">Across the whole project, not just this week.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {byTask.size === 0 ? (
                <p className="text-sm text-ink-muted">No time logged yet — start a timer from any task on the board.</p>
              ) : (
                [...byTask.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([taskId, minutes]) => (
                    <div key={taskId} className="flex items-center justify-between gap-3 text-sm">
                      {taskId === "none" ? (
                        <span className="truncate text-ink-muted">General project work</span>
                      ) : (
                        <Link
                          href={`/projects/${projectId}/tasks/${taskId}`}
                          className="truncate text-ink hover:underline"
                        >
                          {taskTitles.get(taskId) ?? "Task"}
                        </Link>
                      )}
                      <span className="shrink-0 font-medium tabular-nums text-ink">{formatMinutes(minutes)}</span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By person</CardTitle>
              <p className="text-[13px] text-ink-muted">Across the whole project, not just this week.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {byPerson.size === 0 ? (
                <p className="text-sm text-ink-muted">No time logged yet.</p>
              ) : (
                [...byPerson.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([userId, minutes]) => (
                    <div key={userId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink-muted">{userNames.get(userId) ?? "Unknown"}</span>
                      <span className="shrink-0 font-medium tabular-nums text-ink">{formatMinutes(minutes)}</span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Calendar on the left, the selected week on the right. Shared by the team
// and client views so the two can't drift apart.
function WorkDiary({
  basePath,
  selectedWeek,
  days,
  year,
  month,
  minutesByDate,
  entries,
  weekMinutes,
  addTime,
}: {
  basePath: string;
  selectedWeek: Date;
  days: string[];
  year: number;
  month: number;
  minutesByDate: Map<string, number>;
  entries: DiaryEntry[];
  weekMinutes: number;
  addTime: React.ReactNode;
}) {
  const monthQuery = `month=${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold text-ink">Work diary</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
        <WorkDiaryCalendar
          basePath={basePath}
          year={year}
          month={month}
          minutesByDate={minutesByDate}
          selectedWeek={selectedWeek}
        />

        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Link
                href={`${basePath}?${monthQuery}&week=${weekParam(shiftWeek(selectedWeek, -1))}`}
                aria-label="Previous week"
                className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="px-1 text-[15px] font-bold text-ink">{formatWeekRange(selectedWeek)}</span>
              <Link
                href={`${basePath}?${monthQuery}&week=${weekParam(shiftWeek(selectedWeek, 1))}`}
                aria-label="Next week"
                className="flex h-7 w-7 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href={basePath}
                className="ml-1 rounded-[5px] px-2 py-1 text-[13px] font-medium text-ink-secondary hover:bg-hover hover:text-ink"
              >
                This week
              </Link>
            </div>
            {addTime}
          </div>

          <WorkDiaryWeek days={days} entries={entries} />

          <div className="flex items-baseline justify-between gap-4 border-t border-border-soft pt-3">
            <span className="text-[13px] text-ink-secondary">Total this week</span>
            <span className="text-[18px] font-semibold tabular-nums text-ink">
              {formatHoursMinutes(weekMinutes)} hrs
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
