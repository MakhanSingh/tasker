import { createClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/lib/utils/time";
import { TaskTimePanel } from "./TaskTimePanel";

// Fixed locale + explicit fields so server render and client hydration agree.
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The hours behind one task, as the client sees them: a total and the days
 * they were worked, read-only.
 *
 * Only on hourly projects. On a fixed-budget project the client is billed
 * against milestones, so per-task hours are not what they are paying for —
 * showing them would invite the reading that the bill moves with the clock.
 *
 * Sourced from project_hours_summary, never time_entries: clients have no
 * policy on that table at all, so they can't see who logged what, the notes,
 * or the individual entries — only the daily totals.
 */
export async function ClientTaskTime({ projectId, taskId }: { projectId: string; taskId: string }) {
  const supabase = await createClient();

  const { data: billing } = await supabase
    .from("project_billing")
    .select("billing_type")
    .eq("project_id", projectId)
    .maybeSingle();

  if (billing?.billing_type !== "hourly") return null;

  const { data: rows } = await supabase
    .from("project_hours_summary")
    .select("work_date, total_minutes")
    .eq("task_id", taskId)
    .order("work_date", { ascending: false });

  const days = rows ?? [];
  const totalMinutes = days.reduce((sum, row) => sum + Number(row.total_minutes), 0);

  return (
    <TaskTimePanel
      label="Time spent"
      totalMinutes={totalMinutes}
      emptyMessage="No hours logged on this task yet."
    >
      {days.length > 0
        ? days.map((row) => (
            <div key={String(row.work_date)} className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-ink">{formatDay(String(row.work_date))}</span>
              <span className="text-[13px] font-medium tabular-nums text-ink">
                {formatMinutes(Number(row.total_minutes))}
              </span>
            </div>
          ))
        : null}
    </TaskTimePanel>
  );
}
