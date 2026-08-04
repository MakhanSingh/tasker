import { TaskListRow } from "@/components/tasks/TaskListRow";
import { TaskListSection } from "@/components/tasks/TaskListSection";
import type { Database, TaskStatus } from "@/types/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const SECTIONS: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "In review" },
  { status: "done", label: "Done" },
];

// Borderless list, same visual language as the Today view: hairline row
// separators, circle checkboxes, no card wrapper. The four statuses are the
// sections — the board shows the same grouping as columns, the list shows it
// stacked.
export function TaskListView({
  projectId,
  tasks,
  assigneeNamesByTask,
  loggedMinutesByTask,
  commentCountsByTask,
  runningTaskId,
  canChangeStatus,
  projectName,
  addTasks,
}: {
  projectId: string;
  tasks: Task[];
  assigneeNamesByTask: Map<string, string[]>;
  loggedMinutesByTask: Map<string, number>;
  commentCountsByTask: Map<string, number>;
  runningTaskId: string | null;
  projectName?: string;
  canChangeStatus: boolean;
  /**
   * Who may create work here. This used to be `canChangeStatus`, which is a
   * different question — a viewer can move a card assigned to them but cannot
   * create tasks, so they were shown an Add task that the server then refused.
   */
  addTasks: "team" | "client" | null;
}) {
  return (
    <div className="max-w-3xl pl-6">
      {SECTIONS.map(({ status, label }) => {
        const sectionTasks = tasks
          .filter((task) => task.status === status)
          .sort((a, b) => {
            if (!a.due_date && !b.due_date) return a.position - b.position;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
          });

        // An empty section still renders — it's where you add the first task
        // of that status, and hiding it would make the list feel lossy next
        // to the board's always-present columns.
        return (
          <TaskListSection
            key={status}
            label={label}
            count={sectionTasks.length}
            projectId={projectId}
            status={status}
            projectName={projectName}
            statusLabel={label}
            addVariant={addTasks === "client" && status !== "todo" ? null : addTasks}
          >
            {sectionTasks.map((task) => (
              <TaskListRow
                key={task.id}
                projectId={projectId}
                task={task}
                assigneeNames={assigneeNamesByTask.get(task.id) ?? []}
                loggedMinutes={loggedMinutesByTask.get(task.id) ?? 0}
                commentCount={commentCountsByTask.get(task.id) ?? 0}
                isTimerRunning={runningTaskId === task.id}
                canComplete={canChangeStatus}
              />
            ))}
          </TaskListSection>
        );
      })}
    </div>
  );
}
