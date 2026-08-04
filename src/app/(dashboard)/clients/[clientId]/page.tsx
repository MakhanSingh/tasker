import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, CheckCircle2, CircleDollarSign, Clock, FileText, Receipt } from "lucide-react";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { getClientRollup } from "@/lib/clients/rollup";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/StatTile";
import { SectionCard, EmptyRow } from "@/components/dashboard/SectionCard";
import { ProjectProgressRow } from "@/components/dashboard/ProjectProgressRow";
import { ClientEditForm } from "@/components/clients/ClientEditForm";
import { ClientLifecycleActions } from "@/components/clients/ClientLifecycleActions";
import { InviteClientUserDialog } from "@/components/clients/InviteClientUserDialog";
import { displayStatus, STATUS_VARIANT } from "@/lib/invoices/status";
import { formatMinutes } from "@/lib/utils/time";
import { formatMoney } from "@/lib/utils/money";
import { formatDueDate } from "@/lib/todo/buckets";

// A client is the natural grouping for projects — this page rolls all of a
// client's projects up into one set of numbers.
export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireAdmin();
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const [rollup, { data: invoices }] = await Promise.all([
    getClientRollup(clientId),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date, total, currency, issue_date")
      .eq("client_id", clientId),
  ]);


  // Read straight off the profile. Walking projects -> memberships instead
  // meant someone invited a minute ago, before they were put on a project,
  // appeared nowhere — which reads as the invite having failed.
  const { data: portalUserRows } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("client_id", clientId)
    .eq("role", "client");

  const portalUsers = portalUserRows ?? [];

  const recentInvoices = [...(invoices ?? [])]
    .sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)))
    .slice(0, 6);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link href="/clients" className="text-[13px] text-ink-muted hover:underline">
          ← Clients
        </Link>
        <h1 className="mt-1 text-[26px] font-bold text-ink">{client.name}</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {rollup.projects.length === 1 ? "1 project" : `${rollup.projects.length} projects`}
          {rollup.activeProjects > 0 && ` · ${rollup.activeProjects} active`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Projects"
          value={rollup.projects.length}
          hint={`${rollup.activeProjects} active`}
          icon={Briefcase}
          tone="primary"
        />
        <StatTile
          label="Open tasks"
          value={rollup.openTasks}
          hint={`${rollup.doneTasks} done`}
          icon={CheckCircle2}
          tone="info"
        />
        <StatTile
          label="Hours logged"
          value={formatMinutes(rollup.totalMinutes)}
          hint={`${formatMinutes(rollup.uninvoicedMinutes)} not invoiced`}
          icon={Clock}
          tone="success"
        />
        <StatTile
          label="Outstanding"
          value={formatMoney(rollup.outstanding, rollup.currency)}
          hint={rollup.overdueInvoices > 0 ? `${rollup.overdueInvoices} past due` : "All on schedule"}
          icon={CircleDollarSign}
          tone={rollup.overdueInvoices > 0 ? "danger" : "neutral"}
        />
      </div>

      {rollup.uninvoicedMinutes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-warning-border bg-warning-bg px-4 py-3">
          {/* The whole sentence is one flex item — split across several, the
              spaces between them collapse and the words run together. */}
          <span className="flex items-center gap-2 text-[14px] text-warning">
            <Receipt className="h-4 w-4 shrink-0" />
            <span>
              {`${formatMinutes(rollup.uninvoicedMinutes)} of billable time across these projects hasn’t been invoiced yet`}
              {rollup.uninvoicedValue > 0 && (
                <span className="font-semibold">{` — ${formatMoney(rollup.uninvoicedValue, rollup.currency)}`}</span>
              )}
            </span>
          </span>
          <Link
            href="/invoices/new"
            className="shrink-0 text-[13px] font-medium text-warning underline-offset-4 hover:underline"
          >
            Create invoice
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Projects">
          {rollup.projects.length === 0 ? (
            <EmptyRow>No projects for this client yet.</EmptyRow>
          ) : (
            rollup.projects.map((project) => (
              <ProjectProgressRow
                key={project.id}
                project={{
                  id: project.id,
                  name: project.name,
                  status: project.status,
                  doneTasks: project.doneTasks,
                  totalTasks: project.totalTasks,
                }}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Invoices" action={{ label: "View all", href: "/invoices" }}>
          {recentInvoices.length === 0 ? (
            <EmptyRow>No invoices for this client yet.</EmptyRow>
          ) : (
            recentInvoices.map((invoice) => {
              const status = displayStatus(invoice);
              return (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-hover-soft"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-medium text-ink">{invoice.invoice_number}</span>
                      <span className="text-[12px] text-ink-faint">Due {formatDueDate(invoice.due_date)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                    <span className="text-[14px] font-medium text-ink">
                      {formatMoney(invoice.total, invoice.currency)}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </SectionCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ClientEditForm client={client} />
          <div className="border-t border-border-soft pt-5">
            <ClientLifecycleActions
              clientId={clientId}
              clientName={client.name}
              isActive={client.is_active}
              referenceCount={rollup.projects.length + (invoices?.length ?? 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Client portal users</CardTitle>
          <InviteClientUserDialog clientId={clientId} />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {portalUsers.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No portal users yet. Invite one, then grant them access from a project&apos;s Members tab.
            </p>
          ) : (
            portalUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-[5px] border border-border px-4 py-2"
              >
                <div>
                  <p className="text-[14px] font-medium text-ink">{user.full_name}</p>
                  <p className="text-[13px] text-ink-muted">{user.email}</p>
                </div>
                <Badge variant={user.is_active ? "success" : "warning"}>
                  {user.is_active ? "active" : "disabled"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
