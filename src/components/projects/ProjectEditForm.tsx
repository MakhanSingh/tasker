"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { BillingFields } from "@/components/projects/BillingFields";
import { updateProject, type FormState } from "@/app/(dashboard)/projects/actions";
import type { BillingType, Database } from "@/types/database.types";

const initialState: FormState = { error: null };

export function ProjectEditForm({
  project,
  billing,
  clients,
}: {
  project: Database["public"]["Tables"]["projects"]["Row"];
  /** null when the caller can't read project_billing — admins always can. */
  billing: { billing_type: BillingType; hourly_rate: number | null; fixed_budget: number | null } | null;
  clients: Array<{ id: string; name: string }>;
}) {
  const updateWithId = updateProject.bind(null, project.id);
  const [state, formAction, isPending] = useActionState(updateWithId, initialState);
  const [status, setStatus] = useState(project.status);
  // A sentinel rather than "": a Radix SelectItem cannot have an empty value,
  // and the hidden input turns it back into nothing on the way out.
  const [clientId, setClientId] = useState(project.client_id ?? "none");
  const [billingType, setBillingType] = useState<BillingType>(billing?.billing_type ?? "hourly");
  const { formRef, formError, field, errorProps } = useFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client_id">Client</Label>
          <input type="hidden" name="client_id" value={clientId === "none" ? "" : clientId} />
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client_id">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client — internal project</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <input type="hidden" name="status" value={status} />
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="name">
          Project name
        </Label>
        <Input id="name" name="name" defaultValue={project.name} required {...field("name")} />
        <FieldError {...errorProps("name")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={project.description ?? ""} />
      </div>
      <BillingFields
        billingType={billingType}
        onBillingTypeChange={setBillingType}
        defaultHourlyRate={billing?.hourly_rate}
        defaultFixedBudget={billing?.fixed_budget}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={project.start_date ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={project.end_date ?? ""} />
        </div>
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
