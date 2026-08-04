"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { BillingType } from "@/types/database.types";

const OPTIONS: Array<{ value: BillingType; label: string; blurb: string }> = [
  { value: "hourly", label: "Hourly", blurb: "Billed for the hours logged, at a set rate." },
  { value: "fixed", label: "Fixed budget", blurb: "Billed against milestones, whatever the hours." },
];

// Shared by the new-project form and the edit form. Which figure is asked for
// follows the chosen model — a fixed project has no rate to charge, and an
// hourly one has no budget to bill against — and only the relevant one is
// saved, so switching later can't leave a stale number behind.
export function BillingFields({
  billingType,
  onBillingTypeChange,
  defaultHourlyRate,
  defaultFixedBudget,
}: {
  billingType: BillingType;
  onBillingTypeChange: (value: BillingType) => void;
  defaultHourlyRate?: number | null;
  defaultFixedBudget?: number | null;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-[8px] border border-border p-3">
      <legend className="px-1 text-[13px] font-medium text-ink-secondary">Billing</legend>

      <input type="hidden" name="billing_type" value={billingType} />
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onBillingTypeChange(option.value)}
            aria-pressed={billingType === option.value}
            className={cn(
              "flex flex-col gap-0.5 rounded-[6px] border px-3 py-2 text-left transition-colors",
              billingType === option.value
                ? "border-primary bg-selected"
                : "border-border hover:bg-hover-soft"
            )}
          >
            <span className="text-[14px] font-medium text-ink">{option.label}</span>
            <span className="text-[12px] leading-snug text-ink-muted">{option.blurb}</span>
          </button>
        ))}
      </div>

      {billingType === "hourly" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hourly_rate">Hourly rate (USD)</Label>
          <Input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            min="0"
            step="0.01"
            placeholder="45"
            defaultValue={defaultHourlyRate ?? ""}
          />
          <p className="text-[12px] text-ink-muted">Prices logged time when you generate an invoice.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fixed_budget">Total budget (USD)</Label>
          <Input
            id="fixed_budget"
            name="fixed_budget"
            type="number"
            min="0"
            step="0.01"
            placeholder="5000"
            defaultValue={defaultFixedBudget ?? ""}
          />
          <p className="text-[12px] text-ink-muted">
            Add milestones on the project&apos;s Time tab — that&apos;s what gets billed.
          </p>
        </div>
      )}

      <p className="text-[12px] text-ink-faint">
        Rates, budgets and payments are visible to admins and the client only — never to team members.
      </p>
    </fieldset>
  );
}
