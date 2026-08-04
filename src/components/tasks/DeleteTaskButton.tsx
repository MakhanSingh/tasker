"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTask } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";

export function DeleteTaskButton({ projectId, taskId }: { projectId: string; taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label="Delete task"
      title="Delete task"
      onClick={() => {
        startTransition(async () => {
          try {
            await deleteTask(projectId, taskId);
            // replace, not push: push left the deleted task's URL in history,
            // so Back landed on a page that 404s. replace drops it.
            //
            // And no refresh() after it. The card opens as an intercepted
            // route, so refreshing re-fetched the whole tree — including the
            // modal slot still pointing at the task that had just been
            // deleted, which is what produced the 404. deleteTask already
            // revalidates the board, so arriving there is enough.
            router.replace(`/projects/${projectId}/tasks`);
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Failed to delete task");
          }
        });
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] text-ink-faint hover:bg-danger-bg hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
