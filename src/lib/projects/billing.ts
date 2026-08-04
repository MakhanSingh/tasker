import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MilestonePaymentState, ProjectBilling, ProjectInvoice } from "./billingTypes";

export type { MilestonePaymentState, MilestoneView, ProjectBilling, ProjectInvoice } from "./billingTypes";

// Phase 1 bills in one currency; invoices carry their own for the PDF.
const CURRENCY = "USD";

/**
 * A project's commercials, or `null` when the caller may not see them.
 *
 * The null case is not an app-level role check — `project_billing` has no RLS
 * policy for team members at all, so their query simply returns nothing and
 * the panel disappears. The database is the boundary; this function just
 * reports what it handed back.
 *
 * Paid/pending are derived from invoice status on every read rather than
 * stored, so an admin flipping an invoice to paid is reflected here
 * immediately with nothing to keep in sync.
 */
export async function getProjectBilling(projectId: string): Promise<ProjectBilling | null> {
  const supabase = await createClient();

  const { data: billing } = await supabase
    .from("project_billing")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!billing) return null;

  const [{ data: lineItems }, { data: milestones }] = await Promise.all([
    supabase.from("invoice_line_items").select("id, amount, invoice_id").eq("project_id", projectId),
    supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("position"),
  ]);

  const invoiceIds = [...new Set((lineItems ?? []).map((l) => l.invoice_id))];
  const invoicesById = new Map<
    string,
    { number: string; status: string; due_date: string; issue_date: string }
  >();
  if (invoiceIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, issue_date")
      .in("id", invoiceIds);
    (invoices ?? []).forEach((i) =>
      invoicesById.set(i.id, {
        number: i.invoice_number,
        status: i.status,
        due_date: i.due_date,
        issue_date: i.issue_date,
      })
    );
  }

  const today = new Date(new Date().toDateString());
  const isOverdue = (invoice: { status: string; due_date: string }) =>
    invoice.status === "sent" && new Date(invoice.due_date) < today;

  let paid = 0;
  let pending = 0;
  let overdue = 0;
  let invoiced = 0;
  const paymentByLineItem = new Map<string, MilestonePaymentState>();
  // This project's share of each invoice — an invoice can carry lines for
  // several projects, so its own total would overstate what this one owes.
  const shareByInvoice = new Map<string, number>();

  for (const line of lineItems ?? []) {
    const invoice = invoicesById.get(line.invoice_id);
    // A line whose invoice the caller can't read (a draft, for a client)
    // isn't a claim on anyone yet — leave it out of every total.
    if (!invoice || invoice.status === "void") continue;

    const amount = Number(line.amount);
    shareByInvoice.set(line.invoice_id, (shareByInvoice.get(line.invoice_id) ?? 0) + amount);

    if (invoice.status === "paid") {
      paid += amount;
      invoiced += amount;
      paymentByLineItem.set(line.id, "paid");
    } else if (invoice.status === "sent") {
      pending += amount;
      invoiced += amount;
      if (isOverdue(invoice)) overdue += amount;
      paymentByLineItem.set(line.id, isOverdue(invoice) ? "overdue" : "invoiced");
    } else {
      // A draft — visible to admins only, and not yet billed.
      paymentByLineItem.set(line.id, "not_invoiced");
    }
  }

  const invoices: ProjectInvoice[] = [...shareByInvoice.entries()]
    .sort(([a], [b]) =>
      (invoicesById.get(b)?.issue_date ?? "").localeCompare(invoicesById.get(a)?.issue_date ?? "")
    )
    .map(([id, amount]) => {
      const invoice = invoicesById.get(id)!;
      return {
        id,
        number: invoice.number,
        status: invoice.status as ProjectInvoice["status"],
        dueDate: invoice.due_date,
        amount,
      };
    });

  return {
    billingType: billing.billing_type,
    hourlyRate: billing.hourly_rate == null ? null : Number(billing.hourly_rate),
    fixedBudget: billing.fixed_budget == null ? null : Number(billing.fixed_budget),
    currency: CURRENCY,
    paid,
    pending,
    overdue,
    invoiced,
    invoices,
    milestones: (milestones ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      amount: Number(m.amount),
      dueDate: m.due_date,
      status: m.status,
      payment: m.invoice_line_item_id
        ? (paymentByLineItem.get(m.invoice_line_item_id) ?? "not_invoiced")
        : "not_invoiced",
    })),
  };
}
