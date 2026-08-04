"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { addFlatFeeLine, type FormState } from "@/app/(dashboard)/invoices/actions";

const initialState: FormState = { error: null };

export function AddFlatFeeForm({ invoiceId }: { invoiceId: string }) {
  const addWithId = addFlatFeeLine.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(addWithId, initialState);
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        <Label required htmlFor="description">
          Description
        </Label>
        <Input id="description" name="description" required placeholder="Design retainer" {...field("description")} />
        <FieldError {...errorProps("description")} />
      </div>
      <div className="flex w-24 flex-col gap-1.5">
        <Label required htmlFor="quantity">
          Qty
        </Label>
        <Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" defaultValue="1" required {...field("quantity")} />
        <FieldError {...errorProps("quantity")} />
      </div>
      <div className="flex w-32 flex-col gap-1.5">
        <Label required htmlFor="unit_price">
          Unit price
        </Label>
        <Input id="unit_price" name="unit_price" type="number" step="0.01" min="0" required {...field("unit_price")} />
        <FieldError {...errorProps("unit_price")} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add line"}
      </Button>
      <FormError error={formError} className="w-full text-sm text-accent" />
    </form>
  );
}
