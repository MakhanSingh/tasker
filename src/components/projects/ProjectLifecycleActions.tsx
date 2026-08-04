"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteProject, setProjectStatus } from "@/app/(dashboard)/projects/actions";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from "@/lib/projects/status";
import type { ProjectStatus } from "@/types/database.types";

/**
 * Closing a project out.
 *
 * The status dropdown in the edit form could already reach all four states,
 * but sitting between the client picker and the end date it read as another
 * field to fill in rather than an action to take — so nothing was ever marked
 * finished, and the sidebar grew until it was useless. This says what each
 * button does to the project and puts it where you notice it.
 */
export function ProjectLifecycleActions({
  projectId,
  projectName,
  status,
}: {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (fn: () => Promise<void>, after?: () => void) =>
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const move = (next: ProjectStatus) => run(() => setProjectStatus(projectId, next));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PROJECT_STATUS_VARIANT[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>

        {status === "active" && (
          <>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("on_hold")}>
              Put on hold
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("completed")}>
              Mark complete
            </Button>
          </>
        )}

        {status === "on_hold" && (
          <>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("active")}>
              Resume
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("completed")}>
              Mark complete
            </Button>
          </>
        )}

        {status === "completed" && (
          <>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("active")}>
              Reopen
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("archived")}>
              Archive
            </Button>
          </>
        )}

        {status === "archived" && (
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => move("active")}>
            Reopen
          </Button>
        )}
      </div>

      <p className="text-[12px] text-ink-muted">
        {status === "active" || status === "on_hold"
          ? "Completed and archived projects drop out of the sidebar and out of the default Projects list — they stay readable on their own tab."
          : "Out of the sidebar and the default Projects list. Everything on it — tasks, hours, invoices — is untouched and still readable."}
      </p>

      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-[13px] text-ink">Delete {projectName} permanently?</span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => run(() => deleteProject(projectId), () => router.push("/projects"))}
          >
            {isPending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete project
          </Button>
          <span className="ml-2 text-[12px] text-ink-faint">
            Only possible while nothing has been logged, invoiced or attached.
          </span>
        </div>
      )}
    </div>
  );
}
