"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BillingFields } from "@/components/projects/BillingFields";
import { createClientProject, createProject, type FormState } from "@/app/(dashboard)/projects/actions";
import type { BillingType } from "@/types/database.types";

const initialState: FormState = { error: null };

/** A Radix SelectItem can't carry an empty value, so absence needs a name. */
const NO_CLIENT = "none";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

/**
 * The one form for starting a project — the same fields for an admin and a
 * client, because both are describing the same thing.
 *
 * `variant` picks the server action, not the fields. An admin inserts
 * directly; a client goes through a SECURITY DEFINER function so the company
 * is derived from their account rather than trusted from the form. Their
 * Client dropdown holds exactly one option — their own — because RLS scopes
 * the list, and the posted value is ignored server-side regardless.
 */
export function NewProjectForm({
  clients = [],
  variant = "admin",
  onCancel,
}: {
  clients?: Array<{ id: string; name: string }>;
  variant?: "admin" | "client";
  onCancel?: () => void;
}) {
  const isClient = variant === "client";
  // A client has exactly one company, so it starts selected for them. An
  // admin starts on "none": the only thing a new project truly needs is a
  // name, and a company can be attached now or later from Overview.
  const [clientId, setClientId] = useState(isClient ? (clients[0]?.id ?? "") : NO_CLIENT);
  const [status, setStatus] = useState("active");
  const [billingType, setBillingType] = useState<BillingType>("hourly");
  const [state, formAction, isPending] = useActionState(
    isClient ? createClientProject : createProject,
    initialState
  );
  const { formRef, formError, field, errorProps, errors, clear } = useFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label required htmlFor="name">
          Name
        </Label>
        <Input
          id="name"
          name="name"
          required
          autoFocus
          placeholder="Website redesign"
          maxLength={120}
          {...field("name")}
        />
        <FieldError {...errorProps("name")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What is this project about?"
          className="rounded-[5px] border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus aria-invalid:border-accent"
          {...field("description")}
        />
        <FieldError {...errorProps("description")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="client_id">Client</Label>
        <input type="hidden" name="client_id" value={clientId === NO_CLIENT ? "" : clientId} />
        {/* A Radix select is not a native input, so it takes the invalid
            state from the hook and calls clear() from its own change event. */}
        <Select
          value={clientId}
          onValueChange={(value) => {
            setClientId(value);
            clear("client_id");
          }}
        >
          <SelectTrigger id="client_id" aria-invalid={!!errors.client_id || undefined}>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {!isClient && <SelectItem value={NO_CLIENT}>No client — internal project</SelectItem>}
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError {...errorProps("client_id")} />
        {!isClient && clientId === NO_CLIENT && (
          <p className="text-[12px] text-ink-muted">
            Your own work — a site, a campaign. It won&apos;t appear on any client&apos;s invoices or
            totals. You can attach a client later.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <input type="hidden" name="status" value={status} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BillingFields billingType={billingType} onBillingTypeChange={setBillingType} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" name="start_date" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" name="end_date" type="date" />
        </div>
      </div>

      <FormError error={formError} />

      <div className="flex items-center justify-end gap-2 border-t border-border-soft pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {/* Not disabled when the client is missing. A dead button explains
            nothing — you press it, nothing happens, and every field looks
            suspect. Submitting gets you "Select a client" under the one field
            that's actually wrong. */}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add project"}
        </Button>
      </div>
    </form>
  );
}
