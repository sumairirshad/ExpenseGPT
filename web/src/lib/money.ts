// Money is always handled as integer minor units (paisa, cents) once it leaves
// the parser. Never do arithmetic on floats or formatted strings.

export const MAX_AMOUNT = 1_000_000_000; // per transaction, in major units

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  hazar: 1_000,
  hazaar: 1_000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
  m: 1_000_000,
  mn: 1_000_000,
  million: 1_000_000,
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
};

// Optional currency prefix, a number (with thousands separators or decimals),
// and an optional shorthand multiplier. The number must not be glued to other
// letters ("3rd", "abc123") so ordinal dates are not read as amounts.
const AMOUNT_RE =
  /(?<![\w.,])(?:(?:rs\.?|pkr|rupees?)\s*)?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(k|thousand|hazaa?r|lakhs?|lacs?|mn?|million|cr|crores?)\b)?(?![\w])/gi;

export interface AmountMatch {
  value: number;
  start: number;
  end: number;
}

export function findAmounts(text: string): AmountMatch[] {
  const matches: AmountMatch[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const base = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const mult = m[2] ? MULTIPLIERS[m[2].toLowerCase()] ?? 1 : 1;
    matches.push({
      value: roundToMinor(base * mult) / 100,
      start: m.index!,
      end: m.index! + m[0].length,
    });
  }
  return matches;
}

export function parseAmounts(text: string): number[] {
  return [...new Set(findAmounts(text).map((m) => m.value))];
}

export function roundToMinor(major: number): number {
  return Math.round(major * 100);
}

export const toMinor = roundToMinor;

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
