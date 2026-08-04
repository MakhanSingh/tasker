"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteClientRecord, setClientActive } from "@/app/(dashboard)/clients/actions";

/**
 * Retiring a client, and — only when it is genuinely empty — removing it.
 *
 * Archive is the front door and delete is behind a confirmation, because the
 * two are not variations of one action: archiving is reversible and keeps the
 * projects and invoices attached to the name, deleting is neither. A trigger
 * refuses the delete outright when anything still references the client, so
 * the button below can be offered honestly rather than failing halfway.
 */
export function ClientLifecycleActions({
  clientId,
  clientName,
  isActive,
  referenceCount,
}: {
  clientId: string;
  clientName: string;
  isActive: boolean;
  /** Projects + invoices pointing at this client; deletion is off unless zero. */
  referenceCount: number;
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={isActive ? "success" : "warning"}>{isActive ? "active" : "archived"}</Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => setClientActive(clientId, !isActive))}
        >
          {isActive ? "Archive client" : "Restore client"}
        </Button>
      </div>

      <p className="text-[12px] text-ink-muted">
        {isActive
          ? "Archiving hides them from the client list and from new project forms. Their projects and invoices stay exactly as they are."
          : "Archived. They no longer appear when starting a project; everything already recorded against them is untouched."}
      </p>

      {referenceCount === 0 ? (
        confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-accent/40 bg-accent/5 px-3 py-2">
            <span className="text-[13px] text-ink">Delete {clientName} permanently?</span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => run(() => deleteClientRecord(clientId), () => router.push("/clients"))}
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
              Delete client
            </Button>
          </div>
        )
      ) : (
        <p className="text-[12px] text-ink-faint">
          Can&apos;t be deleted — {referenceCount} project{referenceCount === 1 ? "" : "s"} and invoice
          {referenceCount === 1 ? "" : "s"} reference this client. Archive instead.
        </p>
      )}
    </div>
  );
}
