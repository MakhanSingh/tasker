"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors, type ActionResult } from "@/hooks/useFieldErrors";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoicePreview, type PreviewLine } from "@/components/invoices/InvoicePreview";
import { createInvoiceDraft, getUnbilledLines } from "@/app/(dashboard)/invoices/actions";
import { CURRENCIES, DUE_TERMS, dueDateFor, type DueTerm } from "@/lib/invoices/currencies";
import { PAYMENT_KIND_LABEL } from "@/lib/invoices/paymentMethods";
import type { PaymentMethodKind } from "@/types/database.types";
import { formatMoney } from "@/lib/utils/money";

export type BuilderClient = {
  id: string;
  name: string;
  contactEmail: string | null;
  billingAddress: string | null;
};

export type BuilderProject = { id: string; name: string; clientId: string };

export type BuilderPaymentMethod = {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  details: string;
  isDefault: boolean;
};

type Line = {
  description: string;
  quantity: string;
  unitPrice: string;
  /** Set only on lines pulled from logged time; carried through on save. */
  projectId?: string;
  entryIds?: string[];
};

const emptyLine = (): Line => ({ description: "", quantity: "1", unitPrice: "" });

/** Fixed locale so the form and the preview agree, server and client alike. */
function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Today, and today + n days, in the viewer's own timezone. */
function localDate(offsetDays = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Build an invoice with the finished document beside you.
 *
 * Everything on the left is local state until you save, so the preview can
 * show the invoice before it exists — which is the point of the split. The
 * two actions differ in one field: **Send** creates it as `sent`, which is
 * what makes it real (the client can see it, and it starts counting as
 * outstanding); **Save as draft** reaches nobody.
 */
export function InvoiceBuilder({
  clients,
  projects,
  nextNumber,
  fromName,
  fromEmail,
  defaultMemo,
  paymentMethods,
}: {
  clients: BuilderClient[];
  projects: BuilderProject[];
  /** The next number in sequence; editable, and unique-checked on save. */
  nextNumber: string;
  fromName: string;
  fromEmail: string;
  defaultMemo: string;
  paymentMethods: BuilderPaymentMethod[];
}) {
  const defaultMethod = paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0] ?? null;
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState(localDate());
  const [dueTerm, setDueTerm] = useState<DueTerm>("30");
  const [customDue, setCustomDue] = useState(localDate(30));
  const [invoiceNumber, setInvoiceNumber] = useState(nextNumber);
  // Prefilled from the agency default, then free to edit — the invoice keeps
  // whatever is here, so changing the default later never rewrites this one.
  const [notes, setNotes] = useState(defaultMemo);
  const [methodId, setMethodId] = useState(defaultMethod?.id ?? "none");
  const [paymentDetails, setPaymentDetails] = useState(defaultMethod?.details ?? "");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  // One state for the whole action result: its identity is what tells
  // useFieldErrors a new verdict has arrived.
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // The submit buttons live in the toolbar, not inside a <form>, so the ref
  // that scopes "focus the first rejected field" goes on the page wrapper.
  const {
    formRef: panelRef,
    formError,
    errorProps,
    errors: fieldErrors,
    clear,
  } = useFieldErrors<HTMLDivElement>(result);

  // Pulls this client's unbilled hours in as editable lines. Saving stamps
  // the entries behind them so the same hours can't be billed again.
  const pullUnbilled = () => {
    setPullNote(null);
    startTransition(async () => {
      const suggested = await getUnbilledLines(clientId);
      if (suggested.length === 0) {
        setPullNote("No unbilled hours for this client.");
        return;
      }
      setLines((current) => [
        ...current.filter((line) => line.description.trim() || line.unitPrice.trim()),
        ...suggested.map((line) => ({
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          projectId: line.projectId,
          entryIds: line.entryIds,
        })),
      ]);
      setPullNote(`Added ${suggested.length} ${suggested.length === 1 ? "line" : "lines"} from logged time.`);
    });
  };

  // Derived for every term but `custom`, so a due date before the issue date
  // simply can't be expressed rather than being caught on save.
  const dueDate = dueDateFor(dueTerm, issueDate) ?? customDue;

  const client = clients.find((c) => c.id === clientId) ?? null;
  const clientProjects = useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId]
  );

  const previewLines: PreviewLine[] = lines.map((line) => ({
    description: line.description,
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
  }));
  const total = previewLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  // Built once, so the PDF you download and the invoice you save can never
  // describe different things.
  const payload = (send: boolean) => ({
    client_id: clientId,
    invoice_number: invoiceNumber,
    payment_method_kind: paymentMethods.find((m) => m.id === methodId)?.kind,
    payment_details: paymentDetails,
    project_id: projectId === "none" ? "" : projectId,
    currency,
    issue_date: issueDate,
    due_date: dueDate,
    notes,
    send,
    line_items: lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity) || 0,
      unit_price: Number(line.unitPrice) || 0,
      project_id: line.projectId ?? "",
      entry_ids: line.entryIds ?? [],
    })),
  });

  // Renders the PDF from what's on screen without saving anything, so
  // clicking it twice can't mint two invoices.
  const downloadPdf = () => {
    setResult(null);
    startTransition(async () => {
      const res = await fetch("/api/invoices/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(false)),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setResult({ error: data?.error ?? `Couldn't build the PDF (${res.status})` });
        return;
      }

      // A POST can't be a plain link, so the response is turned into a file
      // and handed to the browser as a click.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const save = (send: boolean) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await createInvoiceDraft(payload(send));

      if (outcome.error || !outcome.invoiceId) {
        setResult({ ...outcome, error: outcome.error ?? "Failed to create invoice" });
        return;
      }
      router.push(`/invoices/${outcome.invoiceId}`);
    });
  };

  return (
    <div ref={panelRef} className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-ink-secondary hover:bg-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-bold text-ink">Create invoice</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={downloadPdf}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => save(false)}>
            Save as draft
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={() => save(true)}>
            <Send className="h-4 w-4" />
            {isPending ? "Working…" : "Send invoice"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-0 lg:grid-cols-2">
        {/* Left: the form */}
        <div className="flex flex-col gap-8 px-6 py-8">
          <section className="flex max-w-lg flex-col gap-4">
            <h2 className="text-[18px] font-bold text-ink">Details</h2>

            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="client_id">
                Who are you invoicing?
              </Label>
              <Select
                value={clientId}
                onValueChange={(value) => {
                  setClientId(value);
                  setProjectId("none");
                  clear("client_id");
                }}
              >
                <SelectTrigger
                  id="client_id"
                  aria-invalid={!!fieldErrors.client_id || undefined}
                  aria-describedby="client_id-error"
                >
                  <SelectValue placeholder="Pick a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError {...errorProps("client_id")} />
              {client && !client.contactEmail && (
                <p className="text-[12px] text-warning">
                  This client has no contact email — sending will save it but reach nobody.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Link to a project</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {clientProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-ink-muted">
                Linking it makes this invoice show up on that project&apos;s Payments panel.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label required htmlFor="invoice_number">
                  Invoice number
                </Label>
                <Input
                  id="invoice_number"
                  value={invoiceNumber}
                  onChange={(e) => {
                    setInvoiceNumber(e.target.value);
                    clear("invoice_number");
                  }}
                  maxLength={40}
                  required
                  aria-invalid={!!fieldErrors.invoice_number || undefined}
                  aria-describedby="invoice_number-error"
                />
                <FieldError {...errorProps("invoice_number")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label required htmlFor="issue_date">
                  Issued on
                </Label>
                <Input
                  id="issue_date"
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => {
                    setIssueDate(e.target.value);
                    clear("issue_date");
                  }}
                  aria-invalid={!!fieldErrors.issue_date || undefined}
                  aria-describedby="issue_date-error"
                />
                <FieldError {...errorProps("issue_date")} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Invoice due</Label>
                <Select value={dueTerm} onValueChange={(value) => setDueTerm(value as DueTerm)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DUE_TERMS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {dueTerm === "custom" ? (
                <div className="flex flex-col gap-1.5">
                  <Label required htmlFor="due_date">
                    Due date
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    // Can't pick a date before the invoice exists.
                    min={issueDate}
                    value={customDue}
                    onChange={(e) => {
                      setCustomDue(e.target.value);
                      clear("due_date");
                    }}
                    required
                    aria-invalid={!!fieldErrors.due_date || undefined}
                    aria-describedby="due_date-error"
                  />
                  <FieldError {...errorProps("due_date")} />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>Payable by</Label>
                  <p className="flex h-9 items-center text-[14px] text-ink-muted">
                    {dueTerm === "upon_receipt" ? "As soon as it lands" : formatDisplayDate(dueDate)}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="flex max-w-lg flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[18px] font-bold text-ink">Payment details</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!clientId || isPending}
                onClick={pullUnbilled}
              >
                Pull in unbilled time
              </Button>
            </div>
            {pullNote && <p className="text-[12px] text-ink-muted">{pullNote}</p>}

            {lines.map((line, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-[8px] border border-border p-3">
                <div className="flex flex-col gap-1.5">
                  <Label required htmlFor={`item-${index}`}>
                    Item
                  </Label>
                  <Input
                    id={`item-${index}`}
                    value={line.description}
                    onChange={(e) => {
                      updateLine(index, { description: e.target.value });
                      clear(`line_items.${index}.description`);
                    }}
                    placeholder="Homepage redesign — phase 1"
                    required
                    aria-invalid={!!fieldErrors[`line_items.${index}.description`] || undefined}
                  />
                  <FieldError {...errorProps(`line_items.${index}.description`)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label required htmlFor={`rate-${index}`}>
                      Rate
                    </Label>
                    <Input
                      id={`rate-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => {
                        updateLine(index, { unitPrice: e.target.value });
                        clear(`line_items.${index}.unit_price`);
                      }}
                      placeholder="0.00"
                      required
                      aria-invalid={!!fieldErrors[`line_items.${index}.unit_price`] || undefined}
                    />
                    <FieldError {...errorProps(`line_items.${index}.unit_price`)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label required htmlFor={`qty-${index}`}>
                      Qty
                    </Label>
                    <Input
                      id={`qty-${index}`}
                      type="number"
                      min="0"
                      step="0.25"
                      value={line.quantity}
                      onChange={(e) => {
                        updateLine(index, { quantity: e.target.value });
                        clear(`line_items.${index}.quantity`);
                      }}
                      required
                      aria-invalid={!!fieldErrors[`line_items.${index}.quantity`] || undefined}
                    />
                    <FieldError {...errorProps(`line_items.${index}.quantity`)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Line total</Label>
                    <p className="flex h-9 items-center text-[14px] font-medium tabular-nums text-ink">
                      {formatMoney(
                        (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
                        currency
                      )}
                    </p>
                  </div>
                </div>
                {lines.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      className="text-[13px] text-ink-muted hover:text-accent"
                    >
                      Remove line
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setLines((current) => [...current, emptyLine()])}
              className="flex items-center gap-1.5 py-1 text-[13px] text-ink-muted hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another item
            </button>

            <div className="flex items-baseline justify-between border-t border-border-soft pt-3">
              <span className="text-[14px] text-ink-secondary">Total</span>
              <span className="text-[18px] font-bold tabular-nums text-ink">
                {formatMoney(total, currency)}
              </span>
            </div>
          </section>

          <section className="flex max-w-lg flex-col gap-3">
            <h2 className="text-[18px] font-bold text-ink">How they pay</h2>
            {paymentMethods.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                No payment methods saved yet — add one under Settings and it&apos;ll be pre-filled here.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Payment method</Label>
                <Select
                  value={methodId}
                  onValueChange={(value) => {
                    setMethodId(value);
                    // Picking a method fills its saved details in; they stay
                    // editable, because one invoice often needs a note the
                    // stored method shouldn't carry forever.
                    const picked = paymentMethods.find((m) => m.id === value);
                    setPaymentDetails(picked?.details ?? "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {`${method.label} · ${PAYMENT_KIND_LABEL[method.kind]}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_details">Payment details on the invoice</Label>
              <textarea
                id="payment_details"
                rows={4}
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="Account name, account number, IBAN, a Wise link…"
                className="rounded-[5px] border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
          </section>

          <section className="flex max-w-lg flex-col gap-1.5">
            <Label htmlFor="notes">Memo</Label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, a thank you, a reference number…"
              className="rounded-[5px] border border-border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </section>

          <FormError error={formError} className="max-w-lg text-sm text-accent" />
        </div>

        {/* Right: what the client will get */}
        <div className="bg-sidebar px-6 py-8 lg:sticky lg:top-0">
          <p className="mb-3 text-[13px] font-medium text-ink-secondary">Invoice preview</p>
          <InvoicePreview
            number={invoiceNumber}
            status={"draft"}
            fromName={fromName}
            fromEmail={fromEmail}
            clientName={client?.name ?? null}
            clientEmail={client?.contactEmail ?? null}
            billingAddress={client?.billingAddress ?? null}
            issueDate={issueDate}
            dueDate={dueDate}
            dueOnReceipt={dueTerm === "upon_receipt"}
            currency={currency}
            lines={previewLines}
            notes={notes}
            paymentDetails={paymentDetails}
          />
        </div>
      </div>
    </div>
  );
}
