import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument } from "@/lib/pdf/InvoiceDocument";

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  // ?download=1 saves the file; without it the PDF opens in the browser, which
  // is what you want when you're just checking it before sending.
  const download = new URL(request.url).searchParams.get("download") === "1";
  const supabase = await createClient();

  // RLS gates this: admins see every invoice, a client only their own, and
  // anyone else gets no row at all — so a 404 is the correct response for
  // both "doesn't exist" and "not yours".
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: client }, { data: lineItems }, { data: organization }] = await Promise.all([
    supabase.from("clients").select("name, billing_address, contact_email").eq("id", invoice.client_id).single(),
    supabase
      .from("invoice_line_items")
      .select("id, description, quantity, unit_price, amount")
      .eq("invoice_id", invoiceId)
      .order("created_at"),
    supabase.from("organizations").select("name").eq("id", invoice.org_id).single(),
  ]);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    InvoiceDocument({
      invoice,
      organizationName: organization?.name ?? "Tasker",
      client,
      lineItems: lineItems ?? [],
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
