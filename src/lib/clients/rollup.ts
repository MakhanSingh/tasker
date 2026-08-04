import { createClient } from "@/lib/supabase/server";
import { displayStatus } from "@/lib/invoices/status";
import type { ProjectStatus } from "@/types/database.types";

export type ClientProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  hourlyRate: number | null;
  openTasks: number;
  doneTasks: number;
  totalTasks: number;
  totalMinutes: number;
};

export type ClientRollup = {
  clientId: string;
  projects: ClientProjectSummary[];
  activeProjects: number;
  openTasks: number;
  doneTasks: number;
  totalTasks: number;
  totalMinutes: number;
  /** Billable time not yet attached to an invoice line item. */
  uninvoicedMinutes: number;
  /** What that uninvoiced time is worth at each project's rate. */
  uninvoicedValue: number;
  outstanding: number;
  overdueInvoices: number;
  currency: string;
};

function emptyRollup(clientId: string): ClientRollup {
  return {
    clientId,
    projects: [],
    activeProjects: 0,
    openTasks: 0,
    doneTasks: 0,
    totalTasks: 0,
    totalMinutes: 0,
    uninvoicedMinutes: 0,
    uninvoicedValue: 0,
    outstanding: 0,
    overdueInvoices: 0,
    currency: "USD",
  };
}

// Aggregates everything a client's projects add up to, in one pass over the
// whole (RLS-scoped) dataset — so the clients list can show a row per client
// without running these queries once per client.
export async function getClientRollups(): Promise<Map<string, ClientRollup>> {
  const supabase = await createClient();

  const [{ data: projects }, { data: tasks }, { data: entries }, { data: invoices }] = await Promise.all([
    supabase.from("projects").select("id, name, status, client_id"),
    supabase.from("tasks").select("project_id, status"),
    supabase.from("time_entries").select("project_id, duration_minutes, is_billable, invoice_line_item_id"),
    supabase.from("invoices").select("client_id, total, status, due_date, currency"),
  ]);

  // Rates are admin-only (migration 0012); for anyone else this comes back
  // empty and every uninvoiced value is simply 0.
  const { data: billing } = await supabase.from("project_billing").select("project_id, hourly_rate");
  const rateByProject = new Map(
    (billing ?? []).map((b) => [b.project_id, b.hourly_rate === null ? null : Number(b.hourly_rate)])
  );

  const rollups = new Map<string, ClientRollup>();
  const projectSummaries = new Map<string, ClientProjectSummary>();
  const projectToClient = new Map<string, string>();

  for (const project of projects ?? []) {
    // Internal projects belong to no client, so they roll up to nobody. Their
    // hours and tasks are real, but they are not this client's — counting them
    // anywhere here would overstate somebody's numbers.
    if (project.client_id === null) continue;

    const clientId = project.client_id;
    const rollup = rollups.get(clientId) ?? emptyRollup(clientId);
    const summary: ClientProjectSummary = {
      id: project.id,
      name: project.name,
      status: project.status,
      hourlyRate: rateByProject.get(project.id) ?? null,
      openTasks: 0,
      doneTasks: 0,
      totalTasks: 0,
      totalMinutes: 0,
    };

    projectSummaries.set(project.id, summary);
    projectToClient.set(project.id, clientId);

    rollup.projects.push(summary);
    if (project.status === "active") rollup.activeProjects += 1;
    rollups.set(clientId, rollup);
  }

  for (const task of tasks ?? []) {
    const summary = projectSummaries.get(task.project_id);
    const clientId = projectToClient.get(task.project_id);
    if (!summary || !clientId) continue;
    const rollup = rollups.get(clientId)!;

    summary.totalTasks += 1;
    rollup.totalTasks += 1;
    if (task.status === "done") {
      summary.doneTasks += 1;
      rollup.doneTasks += 1;
    } else {
      summary.openTasks += 1;
      rollup.openTasks += 1;
    }
  }

  for (const entry of entries ?? []) {
    const summary = projectSummaries.get(entry.project_id);
    const clientId = projectToClient.get(entry.project_id);
    if (!summary || !clientId) continue;
    const rollup = rollups.get(clientId)!;
    const minutes = entry.duration_minutes ?? 0;

    summary.totalMinutes += minutes;
    rollup.totalMinutes += minutes;
    // The invoice generator only picks up billable entries, so uninvoiced
    // time has to be counted the same way or the two would disagree.
    if (!entry.is_billable) continue;

    if (entry.invoice_line_item_id === null) {
      rollup.uninvoicedMinutes += minutes;
      rollup.uninvoicedValue += (minutes / 60) * (summary.hourlyRate ?? 0);
    }
  }

  for (const invoice of invoices ?? []) {
    const rollup = rollups.get(invoice.client_id) ?? emptyRollup(invoice.client_id);
    rollup.currency = invoice.currency ?? rollup.currency;
    if (invoice.status === "sent") rollup.outstanding += Number(invoice.total);
    if (displayStatus(invoice) === "overdue") rollup.overdueInvoices += 1;
    rollups.set(invoice.client_id, rollup);
  }

  for (const rollup of rollups.values()) {
    rollup.projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  return rollups;
}

export async function getClientRollup(clientId: string): Promise<ClientRollup> {
  const rollups = await getClientRollups();
  return rollups.get(clientId) ?? emptyRollup(clientId);
}
