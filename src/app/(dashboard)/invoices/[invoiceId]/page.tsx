import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayStatus, STATUS_VARIANT } from "@/lib/invoices/status";
import { InvoiceStatusActions } from "@/components/invoices/InvoiceStatusActions";
import { LineItemsTable } from "@/components/invoices/LineItemsTable";
import { AddFlatFeeForm } from "@/components/invoices/AddFlatFeeForm";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(name, contact_email)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) notFound();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price, amount, project_id")
    .eq("invoice_id", invoiceId)
    .order("created_at");

  // Names for the per-line project links. RLS scopes this, so a line for a
  // project the reader can't see simply renders without a link.
  const projectIds = [...new Set((lineItems ?? []).map((l) => l.project_id).filter(Boolean))] as string[];
  const projectNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
    (projects ?? []).forEach((p) => projectNames.set(p.id, p.name));
  }

  const isAdmin = profile.role === "admin";
  const status = displayStatus(invoice);
  const isEditable = isAdmin && invoice.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/invoices" className="text-sm text-ink-muted hover:underline">
          ← Invoices
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{invoice.invoice_number}</h1>
            <p className="text-sm text-ink-muted">{invoice.clients?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
            <Button asChild variant="ghost" size="sm">
              <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4" />
                View PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              {/* ?download=1 flips Content-Disposition to attachment. */}
              <a href={`/api/invoices/${invoiceId}/pdf?download=1`}>
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
            {isAdmin && <InvoiceStatusActions invoiceId={invoiceId} status={invoice.status} />}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-ink-muted">Issued</p>
            <p className="font-medium text-ink">{invoice.issue_date}</p>
          </div>
          <div>
            <p className="text-ink-muted">Due</p>
            <p className="font-medium text-ink">{invoice.due_date}</p>
          </div>
          <div>
            <p className="text-ink-muted">Total</p>
            <p className="font-medium text-ink">
              {invoice.currency} {Number(invoice.total).toFixed(2)}
            </p>
          </div>
          {invoice.paid_at && (
            <div>
              <p className="text-ink-muted">Paid on</p>
              <p className="font-medium text-ink">{new Date(invoice.paid_at).toLocaleDateString()}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LineItemsTable
            invoiceId={invoiceId}
            lineItems={lineItems ?? []}
            projectNames={projectNames}
            currency={invoice.currency}
            canEdit={isEditable}
          />
        </CardContent>
      </Card>

      {invoice.payment_details && (
        <Card>
          <CardHeader>
            <CardTitle>How to pay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-ink-secondary">{invoice.payment_details}</p>
          </CardContent>
        </Card>
      )}

      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Add a flat fee</CardTitle>
          </CardHeader>
          <CardContent>
            <AddFlatFeeForm invoiceId={invoiceId} />
          </CardContent>
        </Card>
      )}

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-secondary">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
