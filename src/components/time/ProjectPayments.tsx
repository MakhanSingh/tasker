import Link from "next/link";
import { CircleDollarSign, Clock, Receipt, Wallet } from "lucide-react";
import { StatTile } from "@/components/dashboard/StatTile";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils/money";
import { formatMinutes } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { displayStatus, STATUS_VARIANT } from "@/lib/invoices/status";
import {
  MILESTONE_STATUS_LABEL,
  PAYMENT_LABEL,
  PAYMENT_VARIANT,
  type ProjectBilling,
} from "@/lib/projects/billingTypes";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// What the project is worth and what has actually been settled. Rendered for
// admins and for the project's own client; team members never reach it,
// because `getProjectBilling` returns null for them — no rate, no budget, no
// invoice, no payment.
//
// Every figure is derived from invoice status at read time, so marking an
// invoice paid moves money from Pending to Paid here on the next load with
// nothing to synchronise.
export function ProjectPayments({
  billing,
  totalMinutes,
  uninvoicedMinutes,
  manageMilestones,
}: {
  billing: ProjectBilling;
  totalMinutes: number;
  /**
   * null when the caller can't tell invoiced hours from uninvoiced ones — a
   * client reads the grouped rollup, which carries no invoice linkage, so the
   * tile is hidden rather than reporting a confident zero.
   */
  uninvoicedMinutes: number | null;
  /** The admin's edit controls; absent for the client's read-only view. */
  manageMilestones?: React.ReactNode;
}) {
  const { currency } = billing;
  const isFixed = billing.billingType === "fixed";

  const milestoneTotal = billing.milestones.reduce((sum, m) => sum + m.amount, 0);
  const completedValue = billing.milestones
    .filter((m) => m.status === "completed")
    .reduce((sum, m) => sum + m.amount, 0);

  // What's earned but not yet billed. On an hourly project that's logged time
  // at the rate; on a fixed one it's completed milestones not yet on an invoice.
  const notInvoiced = isFixed
    ? billing.milestones
        .filter((m) => m.status === "completed" && m.payment === "not_invoiced")
        .reduce((sum, m) => sum + m.amount, 0)
    : billing.hourlyRate && uninvoicedMinutes !== null
      ? (uninvoicedMinutes / 60) * billing.hourlyRate
      : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold text-ink">Payments</h2>
        <p className="text-[13px] text-ink-muted">
          {isFixed
            ? billing.fixedBudget != null
              ? `Fixed budget — ${formatMoney(billing.fixedBudget, currency)}`
              : "Fixed budget — not set yet"
            : billing.hourlyRate != null
              ? `Hourly — ${formatMoney(billing.hourlyRate, currency)} per hour`
              : "Hourly — rate not set yet"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Paid"
          value={formatMoney(billing.paid, currency)}
          icon={Wallet}
          tone="success"
        />
        <StatTile
          label="Pending payment"
          value={formatMoney(billing.pending, currency)}
          hint={billing.overdue > 0 ? `${formatMoney(billing.overdue, currency)} past due` : "Nothing overdue"}
          icon={Receipt}
          tone={billing.overdue > 0 ? "danger" : billing.pending > 0 ? "warning" : "neutral"}
        />
        {notInvoiced !== null && (
          <StatTile
            label="Not yet invoiced"
            value={formatMoney(notInvoiced, currency)}
            hint={
              isFixed ? "Completed milestones" : `${formatMinutes(uninvoicedMinutes ?? 0)} logged`
            }
            icon={Clock}
            tone="neutral"
          />
        )}
        <StatTile
          label={isFixed ? "Budget remaining" : "Value of hours"}
          value={
            isFixed
              ? formatMoney(Math.max(0, (billing.fixedBudget ?? milestoneTotal) - billing.invoiced), currency)
              : formatMoney(billing.hourlyRate ? (totalMinutes / 60) * billing.hourlyRate : 0, currency)
          }
          hint={isFixed ? `${formatMoney(billing.invoiced, currency)} billed` : formatMinutes(totalMinutes)}
          icon={CircleDollarSign}
          tone="primary"
        />
      </div>

      {billing.invoices.length > 0 && (
        <div className="flex flex-col rounded-[10px] border border-border bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-border-soft px-4 py-3">
            <h3 className="text-[15px] font-bold text-ink">Invoices</h3>
            <span className="text-[13px] text-ink-muted">
              {`${formatMoney(billing.invoiced, currency)} billed on this project`}
            </span>
          </div>
          <ul className="flex flex-col">
            {billing.invoices.map((invoice) => {
              const status = displayStatus({ status: invoice.status, due_date: invoice.dueDate });
              return (
                <li key={invoice.id} className="border-b border-border-soft last:border-0">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-hover-soft"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] text-ink">{invoice.number}</span>
                      <span className="text-[12px] text-ink-faint">Due {formatDate(invoice.dueDate)}</span>
                    </span>
                    <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                    <span className="w-24 shrink-0 text-right text-[14px] font-medium tabular-nums text-ink">
                      {formatMoney(invoice.amount, currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* An invoice can carry lines for several projects, so these are
              this project's share rather than the invoice totals. */}
          <p className="px-4 pb-3 text-[12px] text-ink-faint">
            Amounts shown are this project&apos;s share of each invoice.
          </p>
        </div>
      )}

      {isFixed && (
        <div className="flex flex-col rounded-[10px] border border-border bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-border-soft px-4 py-3">
            <h3 className="text-[15px] font-bold text-ink">Milestones</h3>
            <span className="text-[13px] text-ink-muted">
              {`${formatMoney(completedValue, currency)} of ${formatMoney(milestoneTotal, currency)} completed`}
            </span>
          </div>

          {billing.milestones.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">
              No milestones yet — a fixed-budget project bills against these rather than hours.
            </p>
          ) : (
            <ul className="flex flex-col">
              {billing.milestones.map((milestone) => (
                <li
                  key={milestone.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-soft px-4 py-3 last:border-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate text-[14px] text-ink",
                        milestone.status === "completed" && "text-ink-muted"
                      )}
                    >
                      {milestone.title}
                    </span>
                    <span className="truncate text-[12px] text-ink-faint">
                      {MILESTONE_STATUS_LABEL[milestone.status]}
                      {milestone.dueDate && ` · due ${formatDate(milestone.dueDate)}`}
                    </span>
                  </span>
                  <Badge variant={PAYMENT_VARIANT[milestone.payment]}>{PAYMENT_LABEL[milestone.payment]}</Badge>
                  <span className="w-24 shrink-0 text-right text-[14px] font-medium tabular-nums text-ink">
                    {formatMoney(milestone.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {manageMilestones}
        </div>
      )}
    </section>
  );
}
