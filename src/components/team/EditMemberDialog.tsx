"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
import { sendPasswordResetLink, updateTeamMember, type FormState } from "@/app/(dashboard)/team/actions";

const initialState: FormState = { error: null };

export function EditMemberDialog({
  profileId,
  fullName,
  email,
  role,
  /** You can change your own name and email, but not your own account type. */
  isSelf,
}: {
  profileId: string;
  fullName: string;
  email: string;
  role: "admin" | "member";
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const [state, formAction, isPending] = useActionState(updateTeamMember, initialState);
  const { formRef, formError, field, errorProps, dismissAll } = useFieldErrors(state);
  const [isSending, startSending] = useTransition();
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    // Closing the dialog here reacts to the server action's result, not
    // locally-derivable render state — a legitimate effect, not a smell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  const sendReset = () =>
    startSending(async () => {
      try {
        await sendPasswordResetLink(profileId);
        setSent("Sent. The link works once and expires.");
      } catch (err) {
        setSent(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          dismissAll();
          // Reopening should show what is actually stored, not the account
          // type someone picked and then abandoned by closing the dialog.
          setNextRole(role);
          setSent(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {fullName}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="profile_id" value={profileId} />

          <div className="flex flex-col gap-1.5">
            <Label required htmlFor={`full_name-${profileId}`}>
              Name
            </Label>
            <Input
              id={`full_name-${profileId}`}
              name="full_name"
              required
              defaultValue={fullName}
              {...field("full_name")}
            />
            <FieldError {...errorProps("full_name")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label required htmlFor={`email-${profileId}`}>
              Email
            </Label>
            <Input
              id={`email-${profileId}`}
              name="email"
              type="email"
              required
              defaultValue={email}
              {...field("email")}
            />
            <FieldError {...errorProps("email")} />
            <p className="text-[12px] text-ink-muted">
              This is the address they sign in with. Changing it changes their login.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`role-${profileId}`}>Account type</Label>
            <input type="hidden" name="role" value={nextRole} />
            <Select value={nextRole} onValueChange={(v) => setNextRole(v as "admin" | "member")} disabled={isSelf}>
              <SelectTrigger id={`role-${profileId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {isSelf ? (
              <p className="text-[12px] text-ink-muted">
                Another admin has to change your own account type.
              </p>
            ) : null}
          </div>

          <FormError error={formError} />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-5 flex flex-col gap-1.5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-ink">Password</p>
              <p className="text-[12px] text-ink-muted">
                Emails them a link to set their own. Use it if they never got the invite, or can&apos;t sign in.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={isSending} onClick={sendReset}>
              {isSending ? "Sending…" : "Send reset link"}
            </Button>
          </div>
          {sent ? <p className="text-[12px] text-ink-muted">{sent}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
