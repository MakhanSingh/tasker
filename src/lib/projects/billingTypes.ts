import type { BillingType, InvoiceStatus, MilestoneStatus } from "@/types/database.types";

// Pure types and labels, deliberately kept out of billing.ts — that module
// reaches for the server Supabase client (and so next/headers), which a
// "use client" component cannot import even for a string constant.

export type MilestonePaymentState = "not_invoiced" | "invoiced" | "paid" | "overdue";

export type MilestoneView = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: MilestoneStatus;
  payment: MilestonePaymentState;
};

/** An invoice this project appears on, with the share attributable to it. */
export type ProjectInvoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  dueDate: string;
  /** Only the line items belonging to this project, not the invoice total. */
  amount: number;
};

export type ProjectBilling = {
  billingType: BillingType;
  hourlyRate: number | null;
  fixedBudget: number | null;
  currency: string;
  /** Billed and settled. */
  paid: number;
  /** Billed, sent, still owed — this is what "pending payment" means. */
  pending: number;
  /** Of `pending`, the part already past its due date. */
  overdue: number;
  /** Everything ever billed on this project, paid or not. Excludes voided. */
  invoiced: number;
  /** Newest first. Excludes voided invoices, which claim nothing. */
  invoices: ProjectInvoice[];
  milestones: MilestoneView[];
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export const PAYMENT_LABEL: Record<MilestonePaymentState, string> = {
  not_invoiced: "Not invoiced",
  invoiced: "Awaiting payment",
  paid: "Paid",
  overdue: "Payment overdue",
};

export const PAYMENT_VARIANT: Record<MilestonePaymentState, "default" | "info" | "success" | "danger"> = {
  not_invoiced: "default",
  invoiced: "info",
  paid: "success",
  overdue: "danger",
};
