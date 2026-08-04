"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/field-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createInviteLink,
  type InviteLinkState,
} from "@/app/(dashboard)/projects/[projectId]/members/invite-actions";

const initialState: InviteLinkState = { error: null };

/**
 * Minting a shareable link for one project.
 *
 * The URL comes back once and is never readable again — the database holds
 * only a hash of the token, so there is nothing to go back and look up. That
 * is why the result is a copy box rather than a line in a list: a link you can
 * re-read later is a link sitting in a table waiting for someone else to read.
 */
export function InviteLinkDialog({
  projectId,
  projectName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  trigger?: React.ReactNode;
  /** Controlled when opened from the sidebar's "…" menu, which owns the state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [role, setRole] = useState("editor");
  const [copied, setCopied] = useState(false);
  const createWithId = createInviteLink.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(createWithId, initialState);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCopied(false);
      }}
    >
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline" size="sm">
              <Link2 className="h-4 w-4" />
              Invite link
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to {projectName}</DialogTitle>
        </DialogHeader>

        {state.url ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-secondary">
              Send this to the person joining. It works once, and only for this project.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={state.url} className="font-mono text-[12px]" aria-label="Invite link" />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(state.url!).then(() => setCopied(true));
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[12px] text-ink-muted">
              Copy it now — it can&apos;t be shown again. Only a hash is stored, so nobody can recover
              the link later, including from the database. You can revoke it from the Members tab.
            </p>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="project_role" value={role} />

            <div className="flex flex-col gap-1.5">
              <Label required>They join as</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager — runs the project</SelectItem>
                  <SelectItem value="editor">Editor — does the work</SelectItem>
                  <SelectItem value="viewer">Viewer — follows along, logs own time</SelectItem>
                  <SelectItem value="client">Client — the customer&apos;s own view</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[12px] text-ink-muted">
                A client link only ever grants the client view of this one project — never another
                company&apos;s work, and never your rates or invoices.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expires_days">Expires in</Label>
                <Input
                  id="expires_days"
                  name="expires_days"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue="7"
                />
                <p className="text-[12px] text-ink-muted">days</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Lock to an email</Label>
                <Input id="email" name="email" type="email" placeholder="optional" />
                <p className="text-[12px] text-ink-muted">Forwarding it then achieves nothing.</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <input type="checkbox" name="multi_use" value="true" className="h-4 w-4" />
              Let several people use it (up to 25)
            </label>

            <FormError error={state.error} />

            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
