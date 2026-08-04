"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { flatFeeLineSchema, generateInvoiceSchema, invoiceDraftSchema } from "@/lib/validations/invoice";
import { notifyInvoiceGenerated } from "@/lib/email/notifications";
import type { InvoiceStatus } from "@/types/database.types";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

async function nextInvoiceNumber(orgId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  return `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function generateInvoice(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = generateInvoiceSchema.safeParse({
    ...Object.fromEntries(formData),
    project_ids: formData.getAll("project_ids").map(String),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();

  // The rate lives on project_billing, not projects — see migration 0012.
  const [{ data: projects }, { data: billing }] = await Promise.all([
    supabase.from("projects").select("id, name").in("id", parsed.data.project_ids),
    supabase.from("project_billing").select("project_id, hourly_rate").in("project_id", parsed.data.project_ids),
  ]);

  const rateByProject = new Map((billing ?? []).map((b) => [b.project_id, Number(b.hourly_rate ?? 0)]));

  // Only completed, billable, not-yet-invoiced entries in range are eligible.
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, project_id, task_id, duration_minutes")
    .in("project_id", parsed.data.project_ids)
    .eq("is_billable", true)
    .is("invoice_line_item_id", null)
    .not("ended_at", "is", null)
    .gte("started_at", `${parsed.data.start_date}T00:00:00`)
    .lte("started_at", `${parsed.data.end_date}T23:59:59`);

  if (!entries || entries.length === 0) {
    return { error: "No uninvoiced billable time found for that selection." };
  }

  const taskIds = [...new Set(entries.map((e) => e.task_id).filter((id): id is string => !!id))];
  const taskTitles = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
    (tasks ?? []).forEach((t) => taskTitles.set(t.id, t.title));
  }

  // One line item per (project, task) — the invoice reads as a task
  // breakdown rather than a wall of individual time entries.
  const groups = new Map<string, { projectId: string; taskId: string | null; minutes: number; entryIds: string[] }>();
  for (const entry of entries) {
    const key = `${entry.project_id}:${entry.task_id ?? "none"}`;
    const group = groups.get(key) ?? {
      projectId: entry.project_id,
      taskId: entry.task_id,
      minutes: 0,
      entryIds: [],
    };
    group.minutes += entry.duration_minutes ?? 0;
    group.entryIds.push(entry.id);
    groups.set(key, group);
  }

  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const invoiceNumber = await nextInvoiceNumber(admin.org_id);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      org_id: admin.org_id,
      client_id: parsed.data.client_id,
      invoice_number: invoiceNumber,
      status: "draft",
      issue_date: parsed.data.issue_date,
      due_date: parsed.data.due_date,
      notes: parsed.data.notes || null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return { error: invoiceError?.message ?? "Failed to create invoice" };
  }

  let subtotal = 0;
  for (const group of groups.values()) {
    const hours = Number((group.minutes / 60).toFixed(2));
    const unitPrice = rateByProject.get(group.projectId) ?? 0;
    const amount = Number((hours * unitPrice).toFixed(2));
    subtotal += amount;

    const label = group.taskId ? taskTitles.get(group.taskId) ?? "Task" : "General work";
    const { data: lineItem, error: lineError } = await supabase
      .from("invoice_line_items")
      .insert({
        invoice_id: invoice.id,
        project_id: group.projectId,
        line_type: "time",
        description: `${projectNames.get(group.projectId) ?? "Project"} — ${label}`,
        quantity: hours,
        unit_price: unitPrice,
        amount,
      })
      .select("id")
      .single();

    if (lineError || !lineItem) {
      return { error: lineError?.message ?? "Failed to create line item" };
    }

    // Stamping the line item id onto each entry is the double-billing
    // guard: those entries drop out of every future generation query.
    await supabase.from("time_entries").update({ invoice_line_item_id: lineItem.id }).in("id", group.entryIds);
  }

  await supabase
    .from("invoices")
    .update({ subtotal, total: subtotal })
    .eq("id", invoice.id);

  await notifyInvoiceGenerated({
    invoiceId: invoice.id,
    invoiceNumber,
    clientId: parsed.data.client_id,
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function addFlatFeeLine(invoiceId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = flatFeeLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const amount = Number((parsed.data.quantity * parsed.data.unit_price).toFixed(2));

  const { error } = await supabase.from("invoice_line_items").insert({
    invoice_id: invoiceId,
    line_type: "flat_fee",
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    amount,
  });

  if (error) return { error: error.message };

  await recalculateTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}

export async function removeLineItem(invoiceId: string, lineItemId: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Release any time entries this line billed so they become invoiceable
  // again, then drop the line itself.
  await supabase.from("time_entries").update({ invoice_line_item_id: null }).eq("invoice_line_item_id", lineItemId);

  const { error } = await supabase.from("invoice_line_items").delete().eq("id", lineItemId);
  if (error) throw new Error(error.message);

  await recalculateTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function setInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  await requireAdmin();
  const supabase = await createClient();

  if (status === "void") {
    // Voiding frees every time entry the invoice had locked.
    const { data: lines } = await supabase.from("invoice_line_items").select("id").eq("invoice_id", invoiceId);
    const lineIds = (lines ?? []).map((l) => l.id);
    if (lineIds.length > 0) {
      await supabase.from("time_entries").update({ invoice_line_item_id: null }).in("invoice_line_item_id", lineIds);
    }
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}

async function recalculateTotals(invoiceId: string) {
  const supabase = await createClient();
  const { data: lines } = await supabase.from("invoice_line_items").select("amount").eq("invoice_id", invoiceId);
  const subtotal = (lines ?? []).reduce((sum, l) => sum + Number(l.amount), 0);
  await supabase
    .from("invoices")
    .update({ subtotal, total: subtotal, pdf_path: null })
    .eq("id", invoiceId);
}

/**
 * Creates an invoice from the builder, optionally sending it straight away.
 *
 * Takes a JSON payload rather than FormData: line items are a repeating
 * group, and `Object.fromEntries` keeps only the last of each repeated key.
 *
 * Sending is what makes an invoice real — it flips the status to `sent`,
 * which is what every "outstanding" figure in the app counts and what the
 * client's own list is allowed to show. Saving as a draft deliberately
 * reaches nobody.
 */
export async function createInvoiceDraft(input: unknown): Promise<FormState & { invoiceId?: string }> {
  const admin = await requireAdmin();
  const parsed = invoiceDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const data = parsed.data;
  if (data.due_date < data.issue_date) {
    return { error: "The due date can't be before the issue date." };
  }

  const supabase = await createClient();
  const invoiceNumber = data.invoice_number;

  const lines = data.line_items.map((line) => ({
    ...line,
    amount: Number((line.quantity * line.unit_price).toFixed(2)),
  }));
  const subtotal = Number(lines.reduce((sum, line) => sum + line.amount, 0).toFixed(2));

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      org_id: admin.org_id,
      client_id: data.client_id,
      invoice_number: invoiceNumber,
      status: data.send ? "sent" : "draft",
      issue_date: data.issue_date,
      due_date: data.due_date,
      currency: data.currency,
      subtotal,
      total: subtotal,
      notes: data.notes || null,
      // A snapshot, not a reference: changing a bank account next year must
      // not silently restate where this invoice said to send the money.
      payment_method_kind: data.payment_method_kind ?? null,
      payment_details: data.payment_details || null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error || !invoice) {
    // invoice_number is unique org-wide, and it's editable now.
    if (error?.code === "23505") {
      return { error: `Invoice number ${invoiceNumber} is already used — pick another.` };
    }
    return { error: error?.message ?? "Failed to create invoice" };
  }

  for (const line of lines) {
    const { data: created, error: lineError } = await supabase
      .from("invoice_line_items")
      .insert({
        invoice_id: invoice.id,
        // A line's own project wins over the invoice-wide one: hours pulled
        // in belong to the project they were logged against.
        project_id: line.project_id || data.project_id || null,
        line_type: line.entry_ids?.length ? ("time" as const) : ("flat_fee" as const),
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
      })
      .select("id")
      .single();

    if (lineError || !created) return { error: lineError?.message ?? "Failed to add a line" };

    // Stamping the line id onto each entry is the double-billing guard:
    // those entries drop out of every future "unbilled" query.
    if (line.entry_ids?.length) {
      await supabase
        .from("time_entries")
        .update({ invoice_line_item_id: created.id })
        .in("id", line.entry_ids);
    }
  }

  if (data.send) {
    await notifyInvoiceGenerated({
      invoiceId: invoice.id,
      invoiceNumber,
      clientId: data.client_id,
    });
  }

  revalidatePath("/invoices");
  return { error: null, invoiceId: invoice.id };
}

/**
 * Unbilled hours for a client, grouped into invoice lines.
 *
 * The same grouping the old generate-from-time flow used — one line per
 * (project, task) — but returned to the builder to drop into the form rather
 * than written straight to an invoice, so they can be edited before sending.
 */
export async function getUnbilledLines(clientId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("client_id", clientId);

  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return [];

  const [{ data: entries }, { data: billing }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, project_id, task_id, duration_minutes")
      .in("project_id", projectIds)
      .eq("is_billable", true)
      .is("invoice_line_item_id", null)
      .not("ended_at", "is", null),
    supabase.from("project_billing").select("project_id, hourly_rate").in("project_id", projectIds),
  ]);

  if (!entries || entries.length === 0) return [];

  const taskIds = [...new Set(entries.map((e) => e.task_id).filter((id): id is string => !!id))];
  const taskTitles = new Map<string, string>();
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
    (tasks ?? []).forEach((t) => taskTitles.set(t.id, t.title));
  }

  const rateByProject = new Map((billing ?? []).map((b) => [b.project_id, Number(b.hourly_rate ?? 0)]));
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const groups = new Map<string, { projectId: string; taskId: string | null; minutes: number; ids: string[] }>();
  for (const entry of entries) {
    const key = `${entry.project_id}:${entry.task_id ?? "none"}`;
    const group = groups.get(key) ?? { projectId: entry.project_id, taskId: entry.task_id, minutes: 0, ids: [] };
    group.minutes += entry.duration_minutes ?? 0;
    group.ids.push(entry.id);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    description: `${projectNames.get(group.projectId) ?? "Project"} — ${
      group.taskId ? (taskTitles.get(group.taskId) ?? "Task") : "General work"
    }`,
    quantity: Number((group.minutes / 60).toFixed(2)),
    unitPrice: rateByProject.get(group.projectId) ?? 0,
    projectId: group.projectId,
    entryIds: group.ids,
  }));
}
