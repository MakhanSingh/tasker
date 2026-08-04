import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "bold" },
  muted: { color: "#64748b" },
  section: { marginBottom: 16 },
  label: { color: "#64748b", marginBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 6 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#94a3b8", paddingBottom: 6 },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1.2, textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", paddingVertical: 3 },
  grandTotal: { fontWeight: "bold", fontSize: 12, borderTopWidth: 1, borderTopColor: "#94a3b8", paddingTop: 6 },
  draftStamp: { fontSize: 9, color: "#a8730f", marginTop: 4 },
});

/** Written out, so a PDF is never mistaken for a differently-formatted date. */
function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface InvoiceDocumentProps {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    currency: string;
    subtotal: number;
    total: number;
    notes: string | null;
    status: string;
    payment_details: string | null;
  };
  organizationName: string;
  client: { name: string; billing_address: string | null; contact_email: string | null };
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
}

function money(amount: number, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

export function InvoiceDocument({ invoice, organizationName, client, lineItems }: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice</Text>
            <Text style={styles.muted}>{invoice.invoice_number}</Text>
            {/* A draft is not a bill. Saying so on the page keeps one from
                being forwarded as though it were final. */}
            {invoice.status === "draft" ? (
              <Text style={styles.draftStamp}>DRAFT — not yet issued</Text>
            ) : null}
          </View>
          <View>
            <Text>{organizationName}</Text>
          </View>
        </View>

        <View style={[styles.section, { flexDirection: "row", justifyContent: "space-between" }]}>
          <View>
            <Text style={styles.label}>Billed to</Text>
            <Text>{client.name}</Text>
            {client.billing_address ? <Text style={styles.muted}>{client.billing_address}</Text> : null}
            {client.contact_email ? <Text style={styles.muted}>{client.contact_email}</Text> : null}
          </View>
          <View>
            <Text style={styles.label}>Issued</Text>
            <Text>{formatDate(invoice.issue_date)}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Due</Text>
            <Text>
              {invoice.due_date === invoice.issue_date ? "Upon receipt" : formatDate(invoice.due_date)}
            </Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {lineItems.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colQty}>{Number(item.quantity).toFixed(2)}</Text>
            <Text style={styles.colRate}>{Number(item.unit_price).toFixed(2)}</Text>
            <Text style={styles.colAmount}>{Number(item.amount).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{money(invoice.subtotal, invoice.currency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total</Text>
            <Text>{money(invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        {/* Without this the client has the amount but no idea where to send
            it, which is the one thing an invoice must not leave out. */}
        {invoice.payment_details ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.label}>How to pay</Text>
            <Text>{invoice.payment_details}</Text>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
