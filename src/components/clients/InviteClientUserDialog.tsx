"use client";

import { useActionState, useEffect, useState } from "react";
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
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { inviteClientUser, type FormState } from "@/app/(dashboard)/clients/actions";

const initialState: FormState = { error: null };

export function InviteClientUserDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const inviteWithId = inviteClientUser.bind(null, clientId);
  const [state, formAction, isPending] = useActionState(inviteWithId, initialState);
  const { formRef, formError, field, errorProps, dismissAll } = useFieldErrors(state);

  useEffect(() => {
    // Closing the dialog here reacts to the server action's result, not
    // locally-derivable render state — a legitimate effect, not a smell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The action state lives out here, so without this the next open
        // would show last time's error over freshly blank fields.
        if (!next) dismissAll();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Invite portal user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a client portal user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="full_name">
              Name
            </Label>
            <Input id="full_name" name="full_name" required {...field("full_name")} />
            <FieldError {...errorProps("full_name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="email">
              Email
            </Label>
            <Input id="email" name="email" type="email" required {...field("email")} />
            <FieldError {...errorProps("email")} />
          </div>
          <p className="text-xs text-ink-muted">
            They&apos;ll receive an email to set their password. Grant them access to specific projects from each
            project&apos;s Members tab.
          </p>
          <FormError error={formError} />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
