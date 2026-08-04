// One money formatter for the whole app, so totals read identically on the
// dashboard, the invoice list and the invoice detail page.
export function formatMoney(amount: number | string, currency = "USD") {
  const value = Number(amount) || 0;
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
