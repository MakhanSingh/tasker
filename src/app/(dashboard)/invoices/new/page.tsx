import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import {
  InvoiceBuilder,
  type BuilderClient,
  type BuilderPaymentMethod,
} from "@/components/invoices/InvoiceBuilder";

export default async function NewInvoicePage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: clients }, { data: projects }, { count }, { data: org }, { data: methods }] =
    await Promise.all([
      supabase.from("clients").select("id, name, contact_email, billing_address").eq("is_active", true).order("name"),
      supabase.from("projects").select("id, name, client_id").order("name"),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("org_id", admin.org_id),
      supabase.from("organizations").select("name, invoice_memo").eq("id", admin.org_id).maybeSingle(),
      supabase
        .from("payment_methods")
        .select("id, kind, label, details, is_default")
        .eq("org_id", admin.org_id)
        .order("created_at"),
    ]);

  // The next in sequence, offered as a starting point — it's editable, and
  // the unique index on invoice_number is what actually stops a collision.
  const nextNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const paymentMethods: BuilderPaymentMethod[] = (methods ?? []).map((method) => ({
    id: method.id,
    kind: method.kind,
    label: method.label,
    details: method.details,
    isDefault: method.is_default,
  }));

  const builderClients: BuilderClient[] = (clients ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    contactEmail: client.contact_email,
    billingAddress: client.billing_address,
  }));

  return (
    // Full-bleed: the split needs the whole width rather than being squeezed
    // into the dashboard's usual column.
    <div className="-mx-6 -my-4">
      <InvoiceBuilder
        clients={builderClients}
        // Internal projects — the ones with no client — are left out. An
        // invoice is addressed to somebody, so there is no client whose
        // invoice such a project could ever appear on.
        projects={(projects ?? [])
          .filter((p): p is typeof p & { client_id: string } => p.client_id !== null)
          .map((p) => ({ id: p.id, name: p.name, clientId: p.client_id }))}
        nextNumber={nextNumber}
        fromName={org?.name ?? "Your agency"}
        fromEmail={admin.email}
        defaultMemo={org?.invoice_memo ?? ""}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
