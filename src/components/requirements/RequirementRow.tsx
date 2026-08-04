"use client";

import { useTransition } from "react";
import { Check, EyeOff, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteRequirement,
  setRequirementStatus,
} from "@/app/(dashboard)/projects/[projectId]/requirements/actions";
import { PRIORITY_LABEL, PRIORITY_VARIANT, STATUS_LABEL, STATUS_VARIANT } from "@/lib/requirements/labels";
import type { RequirementPriority, RequirementStatus } from "@/types/database.types";

export function RequirementRow({
  projectId,
  requirement,
  decidedByName,
  isClient,
  canEdit,
  canDelete,
}: {
  projectId: string;
  requirement: {
    id: string;
    title: string;
    description: string | null;
    priority: RequirementPriority;
    status: RequirementStatus;
    is_client_visible: boolean;
    decided_at: string | null;
  };
  decidedByName?: string;
  isClient: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const awaitingClient = requirement.status === "proposed";

  return (
    <div className="flex flex-col gap-2 border-b border-border-soft px-6 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium text-ink">{requirement.title}</p>
          {requirement.description && <p className="text-sm text-ink-muted">{requirement.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={PRIORITY_VARIANT[requirement.priority]}>{PRIORITY_LABEL[requirement.priority]}</Badge>
          <Badge variant={STATUS_VARIANT[requirement.status]}>{STATUS_LABEL[requirement.status]}</Badge>
          {!isClient && !requirement.is_client_visible && (
            <Badge>
              <EyeOff className="mr-1 inline h-3 w-3" />
              internal
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {requirement.decided_at
            ? // Fixed locale, so server render and client hydration produce
              // identical text regardless of the machine's locale.
              `${requirement.status === "approved" ? "Approved" : "Rejected"} by ${decidedByName ?? "client"} on ${new Date(requirement.decided_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : awaitingClient && requirement.is_client_visible
              ? "Waiting for client sign-off"
              : ""}
        </p>

        <div className="flex items-center gap-2">
          {/* Clients get exactly one decision to make, and only while it's
              still awaiting sign-off. */}
          {isClient && awaitingClient && (
            <>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => setRequirementStatus(projectId, requirement.id, "approved"))}
              >
                <Check className="h-3 w-3" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => setRequirementStatus(projectId, requirement.id, "rejected"))}
              >
                <X className="h-3 w-3" />
                Request changes
              </Button>
            </>
          )}

          {canEdit && !isClient && (
            <select
              value={requirement.status}
              disabled={isPending}
              onChange={(e) => run(() => setRequirementStatus(projectId, requirement.id, e.target.value))}
              className="h-8 rounded-md border border-border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-focus"
              aria-label="Requirement status"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}

          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => deleteRequirement(projectId, requirement.id))}
              aria-label="Delete requirement"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
