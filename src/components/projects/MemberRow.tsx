"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { removeProjectMember, updateProjectMemberRole } from "@/app/(dashboard)/projects/[projectId]/members/actions";
import type { ProjectRole } from "@/types/database.types";

export function MemberRow({
  projectId,
  memberRowId,
  fullName,
  email,
  projectRole,
  canEdit,
}: {
  projectId: string;
  memberRowId: string;
  fullName: string;
  email: string;
  projectRole: ProjectRole;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-4 py-2">
      <div>
        <p className="font-medium text-ink">{fullName}</p>
        <p className="text-sm text-ink-muted">{email}</p>
      </div>
      <div className="flex items-center gap-2">
        {canEdit && projectRole !== "client" ? (
          <Select
            value={projectRole}
            onValueChange={(value) => startTransition(() => updateProjectMemberRole(projectId, memberRowId, value))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm capitalize text-ink-muted">{projectRole}</span>
        )}
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(() => removeProjectMember(projectId, memberRowId))}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
