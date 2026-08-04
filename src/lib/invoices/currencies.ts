/**
 * The currencies an invoice can be raised in.
 *
 * Each invoice stores its own code (`invoices.currency`), so changing this
 * list never rewrites history — an invoice already sent in EUR stays in EUR
 * whatever is offered here later.
 */
export const CURRENCIES = [
  { code: "USD", label: "USD — US dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — Pound sterling" },
  { code: "INR", label: "INR — Indian rupee" },
  { code: "AUD", label: "AUD — Australian dollar" },
  { code: "CAD", label: "CAD — Canadian dollar" },
  { code: "AED", label: "AED — UAE dirham" },
  { code: "SGD", label: "SGD — Singapore dollar" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isSupportedCurrency(code: string): boolean {
  return (CURRENCY_CODES as readonly string[]).includes(code);
}

/**
 * Payment terms offered when raising an invoice.
 *
 * Everything except `custom` derives the due date from the issue date, which
 * is what makes "due before it was issued" unrepresentable rather than merely
 * rejected. `upon_receipt` is stored as due_date = issue_date; nothing extra
 * is persisted, and the wording is derived back on display — the same way
 * "overdue" is derived rather than stored.
 */
export const DUE_TERMS = [
  { value: "upon_receipt", label: "Upon receipt", days: 0 },
  { value: "15", label: "15 days from issue date", days: 15 },
  { value: "30", label: "30 days from issue date", days: 30 },
  { value: "90", label: "90 days from issue date", days: 90 },
  { value: "custom", label: "Custom date", days: null },
] as const;

export type DueTerm = (typeof DUE_TERMS)[number]["value"];

/** The due date a term implies, or null for `custom`. */
export function dueDateFor(term: DueTerm, issueDate: string): string | null {
  const match = DUE_TERMS.find((t) => t.value === term);
  if (!match || match.days === null || !issueDate) return null;
  const date = new Date(`${issueDate}T00:00:00`);
  date.setDate(date.getDate() + match.days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
