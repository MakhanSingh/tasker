"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { createTeamMember, type CreateMemberState } from "@/app/(dashboard)/team/actions";

const initialState: CreateMemberState = { error: null };

/**
 * Creates a working account and shows its password once.
 *
 * The body is keyed and remounted every time the dialog closes. Action state
 * outlives a close otherwise, and here that state is somebody's password — the
 * next open would put the last person's credentials over a blank form.
 */
export function AddTeamMemberDialog() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSession((n) => n + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Add user</Button>
      </DialogTrigger>
      <DialogContent>
        <AddTeamMemberBody key={session} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddTeamMemberBody({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState("member");
  const [state, formAction, isPending] = useActionState(createTeamMember, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  if (state.credentials) {
    return <Credentials email={state.credentials.email} password={state.credentials.password} onDone={onClose} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a user</DialogTitle>
      </DialogHeader>
      <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label required htmlFor="add_full_name">
            Name
          </Label>
          <Input id="add_full_name" name="full_name" required {...field("full_name")} />
          <FieldError {...errorProps("full_name")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label required htmlFor="add_email">
            Email
          </Label>
          <Input id="add_email" name="email" type="email" required {...field("email")} />
          <FieldError {...errorProps("email")} />
          <p className="text-[12px] text-ink-muted">This is the address they sign in with.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add_role">Account type</Label>
          <input type="hidden" name="role" value={role} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="add_role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-ink-muted">
          The account works straight away and we&apos;ll show you a password to pass on. Nothing is emailed —
          use <span className="text-ink">Invite team member</span>{" "}
          if you&apos;d rather they set their own.
        </p>

        <FormError error={formError} />

        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Credentials({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
      setCopied(true);
    } catch {
      // Refused often enough — over plain http, or by permissions policy —
      // that failing quietly would read as a dead button. The password is on
      // screen and selectable regardless.
      window.alert("Couldn't copy. Select the password and copy it by hand.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Account created</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">Send these on however you normally reach them.</p>

        <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-hover-soft p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium text-ink-secondary">Email</span>
            <span className="text-sm break-all text-ink">{email}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium text-ink-secondary">Password</span>
            {/* Monospace and selectable: this one gets read down a phone line
                or retyped, so the characters have to be told apart. */}
            <span className="font-mono text-sm break-all text-ink select-all">{password}</span>
          </div>
        </div>

        <p className="rounded-[5px] bg-warning-bg p-3 text-[12px] text-ink">
          Shown once and stored nowhere. If you close this without copying it, use{" "}
          <span className="font-medium">Edit → Send reset link</span>{" "}
          on their row.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? "Copied" : "Copy details"}
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}
