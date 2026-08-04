import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * What a missing task looks like.
 *
 * TaskDetailContent calls notFound() when the row isn't there, and with no
 * not-found boundary anywhere in the app that rendered as a blank white page —
 * which reads as the app having broken rather than as the task being gone.
 * A deleted task, a stale link and a task on a project you can't see all land
 * here, and all three are ordinary.
 */
export function TaskNotFound({ projectId }: { projectId?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <FileQuestion className="h-8 w-8 text-ink-faint" />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-ink">This task isn&apos;t here</p>
        <p className="max-w-sm text-[13px] text-ink-muted">
          It may have been deleted, or it belongs to a project you don&apos;t have access to.
        </p>
      </div>
      {projectId && (
        <Link
          href={`/projects/${projectId}/tasks`}
          className="text-[14px] font-medium text-accent hover:underline"
        >
          Back to the board
        </Link>
      )}
    </div>
  );
}
