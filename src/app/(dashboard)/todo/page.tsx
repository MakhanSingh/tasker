import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { getRunningTimer } from "@/lib/time/getRunningTimer";
import { getMyTaskIds } from "@/lib/tasks/myTasks";
import { InlineAddTask } from "@/components/todo/InlineAddTask";
import { RescheduleButton } from "@/components/todo/RescheduleButton";
import { TodoTaskRow } from "@/components/todo/TodoTaskRow";
import { PersonalTodoRow } from "@/components/todo/PersonalTodoRow";
import { BUCKET_LABEL, bucketFor, todayKey, type DueBucket } from "@/lib/todo/buckets";

type Item =
  | {
      kind: "task";
      id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      project_id: string;
      projectName: string;
    }
  | { kind: "todo"; id: string; title: string; due_date: string | null; is_done: boolean };

const UPCOMING_BUCKETS: DueBucket[] = ["tomorrow", "this_week", "later", "someday"];

function todayHeading() {
  const now = new Date();
  const dayMonth = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${dayMonth} ‧ Today ‧ ${weekday}`;
}

export default async function TodoPage() {
  const profile = await requireProfile();
  // Clients don't do the work, so this view is meaningless for them.
  if (profile.role === "client") redirect("/");

  const supabase = await createClient();
  const today = todayKey();

  const myTaskIds = await getMyTaskIds(supabase, profile.id);
  const [{ data: tasks }, { data: todos }, runningTimer] = await Promise.all([
    myTaskIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("tasks")
          .select("id, title, description, due_date, project_id, status, projects(name)")
          .in("id", myTaskIds)
          .neq("status", "done")
          .order("due_date", { ascending: true }),
    supabase
      .from("personal_todos")
      .select("id, title, due_date, is_done")
      .eq("user_id", profile.id)
      .order("due_date", { ascending: true }),
    getRunningTimer(profile.id),
  ]);

  const openTodos = (todos ?? []).filter((t) => !t.is_done);
  const doneTodos = (todos ?? []).filter((t) => t.is_done);

  const items: Item[] = [
    ...(tasks ?? []).map((task) => ({
      kind: "task" as const,
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      project_id: task.project_id,
      projectName: task.projects?.name ?? "Project",
    })),
    ...openTodos.map((todo) => ({
      kind: "todo" as const,
      id: todo.id,
      title: todo.title,
      due_date: todo.due_date,
      is_done: todo.is_done,
    })),
  ];

  const grouped = new Map<DueBucket, Item[]>();
  for (const item of items) {
    const bucket = bucketFor(item.due_date, today);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), item]);
  }

  const overdueItems = grouped.get("overdue") ?? [];
  const todayItems = grouped.get("today") ?? [];
  const taskCount = overdueItems.length + todayItems.length;

  const running = runningTimer
    ? {
        id: runningTimer.id,
        project_id: runningTimer.project_id,
        task_id: runningTimer.task_id,
        started_at: runningTimer.started_at,
      }
    : null;

  const renderItem = (item: Item, isOverdue: boolean) =>
    item.kind === "task" ? (
      <TodoTaskRow
        key={`task-${item.id}`}
        task={{
          id: item.id,
          project_id: item.project_id,
          title: item.title,
          description: item.description,
          due_date: item.due_date,
        }}
        projectName={item.projectName}
        isOverdue={isOverdue}
        runningEntry={running}
      />
    ) : (
      <PersonalTodoRow
        key={`todo-${item.id}`}
        todo={{ id: item.id, title: item.title, due_date: item.due_date, is_done: item.is_done }}
        isOverdue={isOverdue}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
      <h1 className="text-[26px] font-bold text-ink">Today</h1>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {taskCount === 1 ? "1 task" : `${taskCount} tasks`}
      </p>

      {overdueItems.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <h2 className="text-[14px] font-semibold text-ink">Overdue</h2>
            <RescheduleButton />
          </div>
          {overdueItems.map((item) => renderItem(item, true))}
        </section>
      )}

      <section className="mt-8">
        <div className="border-b border-border pb-1.5">
          <h2 className="text-[14px] font-semibold text-ink">{todayHeading()}</h2>
        </div>
        {todayItems.map((item) => renderItem(item, false))}
        <InlineAddTask />
      </section>

      {UPCOMING_BUCKETS.map((bucket) => {
        const bucketItems = grouped.get(bucket);
        if (!bucketItems || bucketItems.length === 0) return null;
        return (
          <section key={bucket} className="mt-8">
            <div className="border-b border-border pb-1.5">
              <h2 className="text-[14px] font-semibold text-ink">
                {BUCKET_LABEL[bucket]}{" "}
                <span className="font-normal text-ink-faint">({bucketItems.length})</span>
              </h2>
            </div>
            {bucketItems.map((item) => renderItem(item, false))}
          </section>
        );
      })}

      {doneTodos.length > 0 && (
        <section className="mt-8">
          <div className="border-b border-border pb-1.5">
            <h2 className="text-[14px] font-semibold text-ink-muted">
              Completed <span className="font-normal text-ink-faint">({doneTodos.length})</span>
            </h2>
          </div>
          {doneTodos.map((todo) => (
            <PersonalTodoRow key={todo.id} todo={todo} isOverdue={false} />
          ))}
        </section>
      )}
    </div>
  );
}
