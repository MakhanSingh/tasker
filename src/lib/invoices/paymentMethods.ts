import type { PaymentMethodKind } from "@/types/database.types";

/**
 * How a client can pay. Kept as plain labels rather than modelled fields —
 * an IBAN, a Wise handle and an Upwork contract share no useful shape, so
 * each method carries free-text details instead of a column per rail.
 */
export const PAYMENT_KIND_LABEL: Record<PaymentMethodKind, string> = {
  bank: "Bank transfer",
  wise: "Wise",
  upwork: "Upwork",
  other: "Other",
};
