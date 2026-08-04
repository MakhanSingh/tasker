import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { getRunningTimer } from "@/lib/time/getRunningTimer";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskCalendarView, parseMonth } from "@/components/tasks/TaskCalendarView";
import { TaskViewSwitcher, parseTaskView } from "@/components/tasks/TaskViewSwitcher";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";

const CAN_MANAGE_TASKS = ["admin", "manager", "editor"];

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { projectId } = await params;
  const { view: viewParam, month: monthParam } = await searchParams;
  const view = parseTaskView(viewParam);
  const { year, month } = parseMonth(monthParam);
  const profile = await requireProfile();
  const role = await getProjectRole(projectId);
  const isClient = role === "client";
  const supabase = await createClient();

  // Everything this page needs, in three waves instead of nine.
  //
  // Each round trip to Supabase costs ~200ms from here, so what matters is not
  // how many queries there are but how many of them have to wait for an answer
  // before the next can start. These were written one `await` under the
  // previous, which made the page nine trips deep — about 1.8 seconds of
  // nothing but waiting.
  //
  // Wave 1: the project and its tasks, which depend on nothing but the id.
  const [{ data: project }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).single(),
    supabase.from("tasks").select("*").eq("project_id", projectId).order("created_at"),
  ]);

  const taskIds = (tasks ?? []).map((t) => t.id);
  const canManage = !!role && CAN_MANAGE_TASKS.includes(role);

  // Wave 2: everything that needs the task ids, plus the project roster, which
  // doesn't but has no reason to wait its turn.
  //
  // Time and comment counts are shown on the cards themselves, so the board
  // doubles as the time overview rather than sending people to another tab.
  const [{ data: entries }, { data: comments }, runningTimer, { data: assignments }, { data: memberships }] =
    await Promise.all([
      isClient || taskIds.length === 0
        ? Promise.resolve({ data: [] })
        : supabase.from("time_entries").select("task_id, duration_minutes").in("task_id", taskIds),
      taskIds.length === 0
        ? Promise.resolve({ data: [] })
        : supabase.from("task_comments").select("task_id").in("task_id", taskIds),
      isClient ? Promise.resolve(null) : getRunningTimer(profile.id),
      taskIds.length === 0
        ? Promise.resolve({ data: [] })
        : supabase.from("task_assignees").select("task_id, user_id").in("task_id", taskIds),
      canManage
        ? supabase
            .from("project_members")
            .select("user_id")
            .eq("project_id", projectId)
            .neq("project_role", "client")
        : Promise.resolve({ data: [] }),
    ]);

  const loggedMinutesByTask = new Map<string, number>();
  for (const entry of entries ?? []) {
    if (!entry.task_id) continue;
    loggedMinutesByTask.set(
      entry.task_id,
      (loggedMinutesByTask.get(entry.task_id) ?? 0) + (entry.duration_minutes ?? 0)
    );
  }

  const commentCountsByTask = new Map<string, number>();
  for (const comment of comments ?? []) {
    commentCountsByTask.set(comment.task_id, (commentCountsByTask.get(comment.task_id) ?? 0) + 1);
  }

  // Wave 3: one name lookup, not two. The assignees on the cards and the
  // roster in the New task dialog were each fetching profiles separately —
  // two trips for the same table, usually for overlapping people.
  const assigneeIds = (assignments ?? []).map((a) => a.user_id);
  const teamIds = (memberships ?? []).map((m) => m.user_id);
  const wantedIds = [...new Set([...assigneeIds, ...teamIds])];

  const nameById = new Map<string, string>();
  if (wantedIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", wantedIds);
    (profiles ?? []).forEach((p) => nameById.set(p.id, p.full_name));
  }

  const assigneeNamesByTask = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const name = nameById.get(a.user_id);
    if (!name) continue;
    assigneeNamesByTask.set(a.task_id, [...(assigneeNamesByTask.get(a.task_id) ?? []), name]);
  }

  const assignees = teamIds
    .map((id) => ({ id, full_name: nameById.get(id) ?? "" }))
    .filter((a) => a.full_name);

  const canChangeStatus = !!role && !isClient;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskViewSwitcher projectId={projectId} current={view} />
        {canManage && <NewTaskDialog projectId={projectId} assignees={assignees} />}
        {/* Same dialog, client wording, no assignee list. */}
        {isClient && <NewTaskDialog projectId={projectId} variant="client" />}
      </div>

      {view === "board" && (
        <TaskBoard
          projectId={projectId}
          tasks={tasks ?? []}
          assigneeNamesByTask={assigneeNamesByTask}
          loggedMinutesByTask={loggedMinutesByTask}
          commentCountsByTask={commentCountsByTask}
          runningTaskId={runningTimer?.task_id ?? null}
          canChangeStatus={canChangeStatus}
          projectName={project?.name}
          addTasks={canManage ? "team" : isClient ? "client" : null}
        />
      )}

      {view === "list" && (
        <TaskListView
          projectId={projectId}
          tasks={tasks ?? []}
          assigneeNamesByTask={assigneeNamesByTask}
          loggedMinutesByTask={loggedMinutesByTask}
          commentCountsByTask={commentCountsByTask}
          runningTaskId={runningTimer?.task_id ?? null}
          canChangeStatus={canChangeStatus}
          projectName={project?.name}
          addTasks={canManage ? "team" : isClient ? "client" : null}
        />
      )}

      {view === "calendar" && (
        <TaskCalendarView projectId={projectId} tasks={tasks ?? []} year={year} month={month} />
      )}
    </div>
  );
}
