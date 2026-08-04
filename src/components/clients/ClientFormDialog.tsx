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
import { createClientRecord, type FormState } from "@/app/(dashboard)/clients/actions";

const initialState: FormState = { error: null };

export function ClientFormDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createClientRecord, initialState);
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
        <Button>New client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="name">
              Company name
            </Label>
            <Input id="name" name="name" required {...field("name")} />
            <FieldError {...errorProps("name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_email">Contact email</Label>
            <Input id="contact_email" name="contact_email" type="email" {...field("contact_email")} />
            <FieldError {...errorProps("contact_email")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input id="contact_phone" name="contact_phone" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billing_address">Billing address</Label>
            <Input id="billing_address" name="billing_address" />
          </div>
          <FormError error={formError} />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
