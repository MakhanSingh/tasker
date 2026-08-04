import { formatMoney } from "@/lib/utils/money";

export type PreviewLine = { description: string; quantity: number; unitPrice: number };

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * What the client will receive, rendered live beside the form.
 *
 * Deliberately a plain component fed by the builder's state rather than the
 * saved row: the point is to show the invoice *before* it exists, so nothing
 * here may read from the database.
 */
export function InvoicePreview({
  number,
  status,
  fromName,
  fromEmail,
  clientName,
  clientEmail,
  billingAddress,
  issueDate,
  dueDate,
  dueOnReceipt = false,
  currency,
  lines,
  notes,
  paymentDetails = "",
}: {
  number: string;
  status: "draft" | "unpaid";
  fromName: string;
  fromEmail: string;
  clientName: string | null;
  clientEmail: string | null;
  billingAddress: string | null;
  issueDate: string;
  dueDate: string;
  /** Renders "Upon receipt" instead of the date, which equals the issue date. */
  dueOnReceipt?: boolean;
  currency: string;
  lines: PreviewLine[];
  notes: string;
  paymentDetails?: string;
}) {
  const priced = lines.map((line) => ({ ...line, amount: line.quantity * line.unitPrice }));
  const total = priced.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="rounded-[10px] border border-border bg-white p-6 shadow-sm sm:p-8">
      <span
        className={
          status === "draft"
            ? "inline-flex rounded-[5px] bg-hover px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-secondary"
            : "inline-flex rounded-[5px] bg-info-bg px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-info"
        }
      >
        {status}
      </span>

      <h2 className="mt-3 text-[26px] font-bold text-ink">Invoice</h2>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <dl className="flex flex-col gap-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Invoice #</dt>
            <dd className="text-[14px] text-ink">{number}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Issued on</dt>
            <dd className="text-[14px] text-ink">{formatDate(issueDate)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Due</dt>
            <dd className="text-[14px] text-ink">{dueOnReceipt ? "Upon receipt" : formatDate(dueDate)}</dd>
          </div>
        </dl>

        <dl className="flex flex-col gap-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">From</dt>
            <dd className="text-[14px] text-ink">{fromName}</dd>
            <dd className="text-[13px] text-ink-muted">{fromEmail}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Bill to</dt>
            {clientName ? (
              <>
                <dd className="text-[14px] text-ink">{clientName}</dd>
                {clientEmail && <dd className="text-[13px] text-ink-muted">{clientEmail}</dd>}
                {billingAddress && (
                  <dd className="whitespace-pre-line text-[13px] text-ink-muted">{billingAddress}</dd>
                )}
              </>
            ) : (
              // Placeholder bars, so the shape of the document is legible
              // before a client has been picked.
              <>
                <dd className="mt-1 h-3 w-32 rounded bg-hover" />
                <dd className="mt-1.5 h-3 w-44 rounded bg-hover" />
              </>
            )}
          </div>
        </dl>
      </div>

      <p className="mt-6 text-[26px] font-bold text-ink">{formatMoney(total, currency)}</p>

      <table className="mt-6 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Items
            </th>
            <th className="py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Qty
            </th>
            <th className="py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Rate
            </th>
            <th className="py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {priced.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-ink-faint">
                No items yet
              </td>
            </tr>
          ) : (
            priced.map((line, index) => (
              <tr key={index} className="border-b border-border-soft">
                <td className="py-2.5 pr-3 text-ink">{line.description || "Untitled item"}</td>
                <td className="py-2.5 text-right tabular-nums text-ink-muted">{line.quantity}</td>
                <td className="py-2.5 text-right tabular-nums text-ink-muted">
                  {formatMoney(line.unitPrice, currency)}
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-ink">
                  {formatMoney(line.amount, currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-[14px] text-ink-muted">Total ({currency})</span>
        <span className="text-[18px] font-bold tabular-nums text-ink">{formatMoney(total, currency)}</span>
      </div>

      {paymentDetails.trim() && (
        <div className="mt-6 border-t border-border-soft pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">How to pay</p>
          <p className="mt-1 whitespace-pre-line text-[13px] text-ink-secondary">{paymentDetails}</p>
        </div>
      )}

      {notes.trim() && (
        <div className="mt-6 border-t border-border-soft pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Notes</p>
          <p className="mt-1 whitespace-pre-line text-[13px] text-ink-secondary">{notes}</p>
        </div>
      )}
    </div>
  );
}
