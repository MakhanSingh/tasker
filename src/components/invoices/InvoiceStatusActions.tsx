"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setInvoiceStatus } from "@/app/(dashboard)/invoices/actions";
import type { InvoiceStatus } from "@/types/database.types";

export function InvoiceStatusActions({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) {
  const [isPending, startTransition] = useTransition();

  const run = (next: InvoiceStatus, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      try {
        await setInvoiceStatus(invoiceId, next);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  };

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button size="sm" disabled={isPending} onClick={() => run("sent")}>
          Mark as sent
        </Button>
      )}
      {status === "sent" && (
        <Button size="sm" disabled={isPending} onClick={() => run("paid")}>
          Mark as paid
        </Button>
      )}
      {(status === "draft" || status === "sent") && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            run("void", "Void this invoice? Its billed time entries will become invoiceable again.")
          }
        >
          Void
        </Button>
      )}
    </div>
  );
}
