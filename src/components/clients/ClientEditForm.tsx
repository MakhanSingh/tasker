"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { updateClientRecord, type FormState } from "@/app/(dashboard)/clients/actions";
import type { Database } from "@/types/database.types";

const initialState: FormState = { error: null };

export function ClientEditForm({ client }: { client: Database["public"]["Tables"]["clients"]["Row"] }) {
  const updateWithId = updateClientRecord.bind(null, client.id);
  const [state, formAction, isPending] = useActionState(updateWithId, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label required htmlFor="name">
            Company name
          </Label>
          <Input id="name" name="name" defaultValue={client.name} required {...field("name")} />
          <FieldError {...errorProps("name")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_email">Contact email</Label>
          <Input id="contact_email" name="contact_email" type="email" defaultValue={client.contact_email ?? ""} {...field("contact_email")} />
          <FieldError {...errorProps("contact_email")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_phone">Contact phone</Label>
          <Input id="contact_phone" name="contact_phone" defaultValue={client.contact_phone ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billing_address">Billing address</Label>
          <Input id="billing_address" name="billing_address" defaultValue={client.billing_address ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Internal notes</Label>
        <Input id="notes" name="notes" defaultValue={client.notes ?? ""} />
      </div>
      <FormError error={formError} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
