"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/money";
import { STATUS_VARIANT, type DisplayStatus } from "@/lib/invoices/status";
import { cn } from "@/lib/utils/cn";

export type InvoiceRow = {
  id: string;
  number: string;
  clientName: string;
  status: DisplayStatus;
  sentOn: string;
  dueOn: string;
  total: number;
  currency: string;
  /** For sorting; never displayed. */
  issuedAt: string;
};

type TabValue = "all" | "unpaid" | "past_due" | "paid";

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "all", label: "All invoices" },
  { value: "unpaid", label: "Unpaid" },
  { value: "past_due", label: "Past due" },
  { value: "paid", label: "Paid" },
];

// Uppercase, like the status chips people expect on a billing screen — the
// app's own badge colours, just set in small caps.
const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "draft",
  sent: "unpaid",
  overdue: "past due",
  paid: "paid",
  void: "cancelled",
};

/**
 * The invoice list, filtered by tab.
 *
 * "Unpaid" means money actually owed, so it includes past-due ones — a bill
 * doesn't stop being unpaid once it's late. "Past due" is that subset. Drafts
 * and cancelled invoices are owed by nobody and appear only under All.
 *
 * Filtering happens client-side: the whole list is one page's worth, already
 * narrowed by RLS to what this reader may see, so a round-trip per tab would
 * only add latency.
 */
export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const [tab, setTab] = useState<TabValue>("all");

  const counts = useMemo(
    () => ({
      all: invoices.length,
      unpaid: invoices.filter((i) => i.status === "sent" || i.status === "overdue").length,
      past_due: invoices.filter((i) => i.status === "overdue").length,
      paid: invoices.filter((i) => i.status === "paid").length,
    }),
    [invoices]
  );

  const shown = useMemo(() => {
    const filtered = invoices.filter((invoice) => {
      if (tab === "unpaid") return invoice.status === "sent" || invoice.status === "overdue";
      if (tab === "past_due") return invoice.status === "overdue";
      if (tab === "paid") return invoice.status === "paid";
      return true;
    });
    return [...filtered].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [invoices, tab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            aria-pressed={tab === option.value}
            className={cn(
              "rounded-[6px] px-3 py-1.5 text-[14px] font-medium transition-colors",
              tab === option.value ? "bg-hover text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {option.label}
            {counts[option.value] > 0 && (
              <span className="ml-1.5 text-[13px] font-normal text-ink-faint">
                {counts[option.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[10px] border border-border bg-white">
        <p className="border-b border-border-soft px-4 py-3 text-[13px] text-ink-muted">
          {shown.length} {shown.length === 1 ? "invoice" : "invoices"}
        </p>

        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-muted">
            {invoices.length === 0 ? "No invoices yet." : "Nothing here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-border-soft text-left">
                  <th className="px-4 py-2.5 text-[13px] font-medium text-ink-secondary">Sent</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-ink-secondary">Invoice #</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-ink-secondary">Recipient</th>
                  <th className="px-3 py-2.5 text-right text-[13px] font-medium text-ink-secondary">Amount</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-ink-secondary">Due</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-ink-secondary">Status</th>
                  <th className="px-4 py-2.5 text-right text-[13px] font-medium text-ink-secondary">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border-soft last:border-0 hover:bg-hover-soft">
                    <td className="px-4 py-3.5 text-ink-muted">{invoice.sentOn}</td>
                    <td className="px-3 py-3.5">
                      <Link href={`/invoices/${invoice.id}`} className="font-medium text-ink hover:underline">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-ink">{invoice.clientName}</td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums text-ink">
                      {formatMoney(invoice.total, invoice.currency)}
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted">{invoice.dueOn}</td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={STATUS_VARIANT[invoice.status]}
                        className="text-[11px] uppercase tracking-wide"
                      >
                        {STATUS_LABEL[invoice.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {/* Labelled, not a bare icon: straight to the file so you
                          don't have to open an invoice just to save it, and
                          findable without hunting for a faint glyph. */}
                      <a
                        href={`/api/invoices/${invoice.id}/pdf?download=1`}
                        aria-label={`Download ${invoice.number} as PDF`}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-border px-2 py-1 text-[13px] font-medium text-ink-secondary hover:bg-hover hover:text-ink"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
