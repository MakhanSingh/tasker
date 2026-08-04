"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/ui/field-error";
import { addProjectMember, type FormState } from "@/app/(dashboard)/projects/[projectId]/members/actions";

const initialState: FormState = { error: null };

type Candidate = { id: string; full_name: string; email: string };

export function AddMemberForm({
  projectId,
  candidates,
  kind,
}: {
  projectId: string;
  candidates: Candidate[];
  kind: "team" | "client";
}) {
  const addWithId = addProjectMember.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(addWithId, initialState);
  const [userId, setUserId] = useState("");
  const [projectRole, setProjectRole] = useState(kind === "client" ? "client" : "editor");

  if (candidates.length === 0) {
    return <p className="text-sm text-ink-muted">{kind === "client" ? "No client portal users available to add." : "No team members available to add."}</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="project_role" value={projectRole} />
      <div className="flex min-w-[220px] flex-col gap-1.5">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger>
            <SelectValue placeholder={kind === "client" ? "Select a client user" : "Select a team member"} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name} ({c.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind === "team" && (
        <Select value={projectRole} onValueChange={setProjectRole}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Button type="submit" disabled={isPending || !userId}>
        {isPending ? "Adding…" : "Add"}
      </Button>
      <FormError error={state.error} className="w-full text-sm text-accent" />
    </form>
  );
}
