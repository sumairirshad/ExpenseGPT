// Ported from web/src/lib/money.ts — display-only formatting here; all
// amounts are computed server-side and arrive as integer minor units.

const CURRENCY_PREFIX: Record<string, string> = {
  PKR: "Rs. ",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
  SAR: "SAR ",
};

export function formatMoney(minor: number, currency = "PKR"): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const hasFraction = abs % 100 !== 0;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `;
  return `${negative ? "-" : ""}${prefix}${number}`;
}

/** Signed short form for lists: "+150,000" / "-850". */
export function formatSigned(minor: number, type: "income" | "expense"): string {
  const abs = Math.abs(minor);
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: abs % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  return `${type === "income" ? "+" : "-"}${number}`;
}
