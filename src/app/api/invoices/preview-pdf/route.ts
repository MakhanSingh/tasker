import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { InvoiceDocument } from "@/lib/pdf/InvoiceDocument";
import { invoiceDraftSchema } from "@/lib/validations/invoice";

/**
 * Renders a PDF from an unsaved invoice.
 *
 * Deliberately writes nothing. The builder's whole left side is unsaved state,
 * and downloading to check the layout must not have side effects — a
 * save-on-download would mint a fresh invoice, and burn a number, every time
 * someone clicked it twice. Recording the invoice is what Save and Send are
 * for, and both sit next to this button.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();

  const parsed = invoiceDraftSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid invoice" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const supabase = await createClient();
  const [{ data: client }, { data: organization }] = await Promise.all([
    // RLS still applies: an admin can read their org's clients, and a
    // client_id from outside it simply returns nothing.
    supabase
      .from("clients")
      .select("name, billing_address, contact_email")
      .eq("id", data.client_id)
      .maybeSingle(),
    supabase.from("organizations").select("name").eq("id", admin.org_id).maybeSingle(),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const lineItems = data.line_items.map((line, index) => ({
    id: String(index),
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    amount: Number((line.quantity * line.unit_price).toFixed(2)),
  }));
  const total = Number(lineItems.reduce((sum, line) => sum + line.amount, 0).toFixed(2));

  const buffer = await renderToBuffer(
    InvoiceDocument({
      invoice: {
        invoice_number: data.invoice_number,
        issue_date: data.issue_date,
        due_date: data.due_date,
        currency: data.currency,
        subtotal: total,
        total,
        notes: data.notes || null,
        // Unsaved, so it carries the draft stamp: this file is not a bill
        // until it has been sent.
        status: "draft",
        payment_details: data.payment_details || null,
      },
      organizationName: organization?.name ?? "Tasker",
      client,
      lineItems,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.invoice_number}.pdf"`,
    },
  });
}
