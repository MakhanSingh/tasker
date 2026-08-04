import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getRunningTimer } from "@/lib/time/getRunningTimer";
import { TaskTimePanel } from "./TaskTimePanel";
import { TaskTimerControls } from "./TaskTimerControls";
import { AddTimeForm } from "./AddTimeForm";
import { TaskTimeEntryRow } from "./TaskTimeEntryRow";

// The task sidebar's time panel: the total, a timer for work happening now,
// and manual entries for work already done. Everything logged here is
// billable — a project that isn't billed simply doesn't get hours logged
// against it — so there is no billable/non-billable split to show.
export async function TaskTimeSection({
  projectId,
  taskId,
  taskTitle,
  canLogTime,
}: {
  projectId: string;
  taskId: string;
  taskTitle: string;
  canLogTime: boolean;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: entries }, runningTimer] = await Promise.all([
    supabase
      .from("time_entries")
      .select("*")
      .eq("task_id", taskId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false }),
    canLogTime ? getRunningTimer(profile.id) : Promise.resolve(null),
  ]);

  const rows = entries ?? [];
  const userIds = [...new Set(rows.map((e) => e.user_id))];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    (profiles ?? []).forEach((p) => userNames.set(p.id, p.full_name));
  }

  // Whose hours these are only matters once more than one person logged any.
  const showAuthor = userIds.length > 1;
  const totalMinutes = rows.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

  return (
    <TaskTimePanel
      label="Time"
      totalMinutes={totalMinutes}
      controls={
        canLogTime ? (
          <>
            <TaskTimerControls
              projectId={projectId}
              taskId={taskId}
              runningEntry={
                runningTimer
                  ? {
                      id: runningTimer.id,
                      project_id: runningTimer.project_id,
                      task_id: runningTimer.task_id,
                      started_at: runningTimer.started_at,
                      label:
                        runningTimer.task_id === taskId
                          ? taskTitle
                          : (runningTimer.projects?.name ?? "another project"),
                    }
                  : null
              }
            />
            <AddTimeForm projectId={projectId} taskId={taskId} />
          </>
        ) : null
      }
    >
      {rows.length > 0
        ? rows.map((entry) => (
            <TaskTimeEntryRow
              key={entry.id}
              entry={entry}
              authorName={userNames.get(entry.user_id) ?? "Unknown"}
              showAuthor={showAuthor}
              canDelete={canLogTime && entry.user_id === profile.id}
            />
          ))
        : null}
    </TaskTimePanel>
  );
}
