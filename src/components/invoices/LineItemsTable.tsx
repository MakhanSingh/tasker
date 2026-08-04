"use client";

import Link from "next/link";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeLineItem } from "@/app/(dashboard)/invoices/actions";

type LineItem = {
  id: string;
  description: string;
  /** The project this line bills for, when it belongs to one. */
  project_id?: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
};

export function LineItemsTable({
  invoiceId,
  lineItems,
  projectNames,
  currency,
  canEdit,
}: {
  invoiceId: string;
  lineItems: LineItem[];
  projectNames?: Map<string, string>;
  currency: string;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (lineItems.length === 0) {
    return <p className="p-6 text-sm text-ink-muted">No line items.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-ink-muted">
          <th className="px-6 py-3 font-medium">Description</th>
          <th className="px-6 py-3 text-right font-medium">Qty</th>
          <th className="px-6 py-3 text-right font-medium">Rate</th>
          <th className="px-6 py-3 text-right font-medium">Amount</th>
          {canEdit && <th className="px-6 py-3" />}
        </tr>
      </thead>
      <tbody>
        {lineItems.map((item) => (
          <tr key={item.id} className="border-b border-border-soft last:border-0">
            <td className="px-6 py-3 text-ink">
              <span className="flex flex-col gap-0.5">
                {item.description}
                {/* Which project the money is for — the link back that makes
                    an invoice traceable to the work it bills. */}
                {item.project_id && projectNames?.get(item.project_id) && (
                  <Link
                    href={`/projects/${item.project_id}/time`}
                    className="text-[12px] text-ink-muted hover:underline"
                  >
                    {projectNames.get(item.project_id)}
                  </Link>
                )}
              </span>
            </td>
            <td className="px-6 py-3 text-right text-ink-muted">{Number(item.quantity).toFixed(2)}</td>
            <td className="px-6 py-3 text-right text-ink-muted">{Number(item.unit_price).toFixed(2)}</td>
            <td className="px-6 py-3 text-right font-medium text-ink">
              {currency} {Number(item.amount).toFixed(2)}
            </td>
            {canEdit && (
              <td className="px-6 py-3 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await removeLineItem(invoiceId, item.id);
                      } catch (err) {
                        window.alert(err instanceof Error ? err.message : "Failed to remove line item");
                      }
                    })
                  }
                >
                  Remove
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
