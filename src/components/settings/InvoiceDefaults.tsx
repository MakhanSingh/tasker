"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import {
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  updateInvoiceMemo,
  type FormState,
} from "@/app/(dashboard)/settings/actions";
import { PAYMENT_KIND_LABEL } from "@/lib/invoices/paymentMethods";
import type { PaymentMethodKind } from "@/types/database.types";

const initialState: FormState = { error: null };

export type PaymentMethodRow = {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  details: string;
  isDefault: boolean;
};

/**
 * The agency's invoice defaults: a memo dropped onto every new invoice, and
 * the accounts a client can pay into.
 *
 * Both are *defaults*. Each invoice keeps its own copy of whichever was used,
 * so changing a bank account here never restates where an already-sent
 * invoice said to send the money.
 */
export function InvoiceDefaults({
  memo,
  methods,
}: {
  memo: string;
  methods: PaymentMethodRow[];
}) {
  const router = useRouter();
  const [memoState, memoAction, memoPending] = useActionState(updateInvoiceMemo, initialState);
  const [methodState, methodAction, methodPending] = useActionState(addPaymentMethod, initialState);
  const [adding, setAdding] = useState(false);
  const {
    formRef: memoFormRef,
    formError: memoFormError,
    field: memoField,
    errorProps: memoErrorProps,
  } = useFieldErrors(memoState);
  const {
    formRef: methodFormRef,
    formError: methodFormError,
    field: methodField,
    errorProps: methodErrorProps,
  } = useFieldErrors(methodState);
  const [kind, setKind] = useState<PaymentMethodKind>("bank");
  const [, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  return (
    <div className="flex flex-col gap-8">
      <form ref={memoFormRef} action={memoAction} noValidate className="flex max-w-md flex-col gap-1.5">
        <Label htmlFor="invoice_memo">Default invoice memo</Label>
        <textarea
          id="invoice_memo"
          name="invoice_memo"
          rows={3}
          defaultValue={memo}
          placeholder="Thanks for your business. Payment within 30 days, please."
          className="rounded-[5px] border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus aria-invalid:border-accent"
          {...memoField("invoice_memo")}
        />
        <FieldError {...memoErrorProps("invoice_memo")} />
        <p className="text-xs text-ink-muted">
          Added to every new invoice, and editable on each one before you send it.
        </p>
        <FormError error={memoFormError} />
        {memoState.success && <p className="text-sm text-success">Saved.</p>}
        <div className="mt-1">
          <Button type="submit" size="sm" variant="outline" disabled={memoPending}>
            {memoPending ? "Saving…" : "Save memo"}
          </Button>
        </div>
      </form>

      <div className="flex max-w-md flex-col gap-3">
        <div>
          <p className="text-[14px] font-medium text-ink">How clients pay you</p>
          <p className="text-xs text-ink-muted">
            The default is pre-filled on new invoices. Only admins can see these.
          </p>
        </div>

        {methods.length > 0 && (
          <ul className="flex flex-col divide-y divide-border-soft rounded-[8px] border border-border">
            {methods.map((method) => (
              <li key={method.id} className="flex items-start gap-3 px-3 py-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] text-ink">{method.label}</span>
                    <Badge>{PAYMENT_KIND_LABEL[method.kind]}</Badge>
                    {method.isDefault && <Badge variant="success">default</Badge>}
                  </span>
                  <span className="whitespace-pre-line text-[12px] text-ink-muted">{method.details}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {!method.isDefault && (
                    <button
                      type="button"
                      title="Make default"
                      aria-label={`Make ${method.label} the default`}
                      onClick={() => run(() => setDefaultPaymentMethod(method.id))}
                      className="rounded p-1 text-ink-faint hover:text-success"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${method.label}`}
                    onClick={() => run(() => deletePaymentMethod(method.id))}
                    className="rounded p-1 text-ink-faint hover:text-accent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form
            ref={methodFormRef}
            action={methodAction}
            noValidate
            className="flex flex-col gap-2 rounded-[8px] bg-hover-soft p-3"
          >
            <input type="hidden" name="kind" value={kind} />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Method</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as PaymentMethodKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_KIND_LABEL) as PaymentMethodKind[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {PAYMENT_KIND_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label required htmlFor="method-label">
                  Name
                </Label>
                <Input
                  id="method-label"
                  name="label"
                  required
                  placeholder="HDFC current account"
                  {...methodField("label")}
                />
                <FieldError {...methodErrorProps("label")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="method-details">
                Details the client needs
              </Label>
              <textarea
                id="method-details"
                name="details"
                rows={3}
                required
                placeholder={"Account name: Tasker Studio\nAccount no: 1234567890\nIFSC: HDFC0001234"}
                className="rounded-[5px] border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus aria-invalid:border-accent"
                {...methodField("details")}
              />
              <FieldError {...methodErrorProps("details")} />
            </div>
            <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <input type="checkbox" name="is_default" value="true" className="h-3.5 w-3.5" />
              Use this by default on new invoices
            </label>
            <FormError error={methodFormError} className="text-[12px] text-accent" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={methodPending}>
                {methodPending ? "Adding…" : "Add method"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 py-1 text-[13px] text-ink-muted hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a payment method
          </button>
        )}
      </div>
    </div>
  );
}
