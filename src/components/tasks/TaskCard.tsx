import Link from "next/link";
import { Clock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TaskStatusSelect } from "@/components/tasks/TaskStatusSelect";
import { formatMinutes } from "@/lib/utils/time";
import type { Database } from "@/types/database.types";

const PRIORITY_VARIANT = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export function TaskCard({
  projectId,
  task,
  assigneeNames,
  loggedMinutes,
  commentCount,
  isTimerRunning,
  canChangeStatus,
}: {
  projectId: string;
  task: Task;
  assigneeNames: string[];
  loggedMinutes: number;
  commentCount: number;
  isTimerRunning: boolean;
  canChangeStatus: boolean;
}) {
  // The status control deliberately sits outside the link rather than nested
  // inside it — an interactive control inside an anchor swallows clicks and
  // is invalid markup.
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-white p-3 hover:border-border">
      <Link href={`/projects/${projectId}/tasks/${task.id}`} className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink hover:underline">{task.title}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
          {isTimerRunning && (
            <Badge variant="success">
              <Clock className="mr-1 inline h-3 w-3" />
              running
            </Badge>
          )}
          {loggedMinutes > 0 && !isTimerRunning && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Clock className="h-3 w-3" />
              {formatMinutes(loggedMinutes)}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {assigneeNames.length > 0 ? (
            <span className="truncate text-xs text-ink-muted">
              {assigneeNames.length > 2
                ? `${assigneeNames[0]} +${assigneeNames.length - 1}`
                : assigneeNames.join(", ")}
            </span>
          ) : (
            <span className="text-xs text-ink-faint">Unassigned</span>
          )}
          {task.due_date && <span className="shrink-0 text-xs text-ink-muted">{task.due_date}</span>}
        </div>
      </Link>

      {canChangeStatus && <TaskStatusSelect projectId={projectId} taskId={task.id} status={task.status} />}
    </div>
  );
}
