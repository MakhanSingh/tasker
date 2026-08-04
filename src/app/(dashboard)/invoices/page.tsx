import Link from "next/link";
import { Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { InvoiceList, type InvoiceRow } from "@/components/invoices/InvoiceList";
import { displayStatus } from "@/lib/invoices/status";

// Fixed locale + explicit fields so server render and client hydration agree.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function InvoicesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, total, currency, clients(name)")
    .order("issue_date", { ascending: false });

  const rows: InvoiceRow[] = (invoices ?? []).map((invoice) => ({
    id: invoice.id,
    number: invoice.invoice_number,
    clientName: invoice.clients?.name ?? "—",
    status: displayStatus(invoice),
    sentOn: formatDate(invoice.issue_date),
    dueOn: formatDate(invoice.due_date),
    total: Number(invoice.total),
    currency: invoice.currency ?? "USD",
    issuedAt: invoice.issue_date,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Invoices</h1>
        {profile.role === "admin" && (
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              Create invoice
            </Link>
          </Button>
        )}
      </div>

      <InvoiceList invoices={rows} />
    </div>
  );
}
