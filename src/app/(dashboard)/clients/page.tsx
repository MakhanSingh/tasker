import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { getClientRollups } from "@/lib/clients/rollup";
import { Card, CardContent } from "@/components/ui/card";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { formatMinutes } from "@/lib/utils/time";
import { formatMoney } from "@/lib/utils/money";

export default async function ClientsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, rollups] = await Promise.all([
    supabase.from("clients").select("*").order("is_active", { ascending: false }).order("name"),
    // One pass for every client, rather than a query per row.
    getClientRollups(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-ink">Clients</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Each client groups its projects — hours, tasks and billing roll up here.
          </p>
        </div>
        <ClientFormDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <p className="p-6 text-[13px] text-ink-muted">No clients yet — add your first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-border text-left text-[13px] text-ink-muted">
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Projects</th>
                    <th className="px-5 py-3 font-medium">Open tasks</th>
                    <th className="px-5 py-3 font-medium">Hours</th>
                    <th className="px-5 py-3 font-medium">Uninvoiced</th>
                    <th className="px-5 py-3 font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const rollup = rollups.get(client.id);
                    const projectCount = rollup?.projects.length ?? 0;
                    const uninvoiced = rollup?.uninvoicedValue ?? 0;
                    const outstanding = rollup?.outstanding ?? 0;

                    return (
                      <tr key={client.id} className="border-b border-border-soft last:border-0 hover:bg-hover-soft">
                        <td className="px-5 py-3">
                          <Link
                            href={`/clients/${client.id}`}
                            className={
                              client.is_active
                                ? "font-medium text-ink hover:underline"
                                : "font-medium text-ink-muted hover:underline"
                            }
                          >
                            {client.name}
                          </Link>
                          {!client.is_active && (
                            <Badge variant="warning" className="ml-2">
                              archived
                            </Badge>
                          )}
                          {client.contact_email && (
                            <p className="text-[12px] text-ink-faint">{client.contact_email}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-ink-muted">
                          {projectCount === 0 ? "—" : projectCount}
                          {(rollup?.activeProjects ?? 0) > 0 && (
                            <span className="text-[12px] text-ink-faint"> · {rollup?.activeProjects} active</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{rollup?.openTasks || "—"}</td>
                        <td className="px-5 py-3 text-ink-muted">
                          {rollup?.totalMinutes ? formatMinutes(rollup.totalMinutes) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {uninvoiced > 0 ? (
                            <span className="font-medium text-warning">
                              {formatMoney(uninvoiced, rollup?.currency)}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {outstanding > 0 ? (
                            <span
                              className={
                                (rollup?.overdueInvoices ?? 0) > 0 ? "font-medium text-accent" : "font-medium text-ink"
                              }
                            >
                              {formatMoney(outstanding, rollup?.currency)}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
