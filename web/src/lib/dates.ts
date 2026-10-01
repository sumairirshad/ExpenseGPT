// Calendar dates are plain "YYYY-MM-DD" strings in the user's timezone.
// The AI never does date math: it hands us a phrase ("yesterday", "last friday",
// "oct 3") and we resolve it here, deterministically.

export const MAX_PAST_DAYS = 365;
export const MAX_FUTURE_DAYS = 7;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

function isValidYmd(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthIndex(word: string): number {
  return MONTHS.indexOf(word.slice(0, 3).toLowerCase());
}

/**
 * Regex for date phrases we understand. Used by the rule-based extractor to
 * pull the phrase out of a message, and by `resolveDate` to interpret it.
 */
export const DATE_PHRASE_RE = new RegExp(
  [
    String.raw`\b\d{4}-\d{2}-\d{2}\b`,
    String.raw`\bday before yesterday\b`,
    String.raw`\b(?:yesterday|today|tonight|last night|this morning|aaj|kal|parson)\b`,
    String.raw`\b\d{1,2} days? ago\b`,
    String.raw`\b(?:last|on|this(?: past)?)\s+(?:${WEEKDAYS.join("|")})\b`,
    String.raw`\b(?:on\s+)?(?:${MONTHS.join("|")})[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b`,
    String.raw`\b(?:on\s+)?(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONTHS.join("|")})[a-z]*(?:,?\s+\d{4})?\b`,
    String.raw`\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b`,
    String.raw`\bthe\s+\d{1,2}(?:st|nd|rd|th)\b`,
  ].join("|"),
  "i",
);

/**
 * Resolve a date phrase relative to `today` (YYYY-MM-DD in the user's tz).
 * Returns null when the phrase is not understood.
 */
export function resolveDate(expression: string | null | undefined, today: string): string | null {
  if (expression == null) return today;
  const e = expression.trim().toLowerCase().replace(/\s+/g, " ");
  if (e === "" || ["today", "now", "tonight", "this morning", "aaj"].includes(e)) return today;
  if (["yesterday", "last night", "kal"].includes(e)) return addDays(today, -1);
  if (["day before yesterday", "parson"].includes(e)) return addDays(today, -2);

  let m = e.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidYmd(y, mo, d) ? ymd(y, mo, d) : null;
  }

  m = e.match(/^(\d{1,2}) days? ago$/);
  if (m) return addDays(today, -Number(m[1]));

  m = e.match(new RegExp(`^(last|on|this past|this)?\\s*(${WEEKDAYS.join("|")})$`));
  if (m) {
    const target = WEEKDAYS.indexOf(m[2]);
    let diff = (weekdayOf(today) - target + 7) % 7;
    if (diff === 0 && m[1] === "last") diff = 7;
    return addDays(today, -diff);
  }

  const [ty, tm, td] = today.split("-").map(Number);

  // "oct 3", "october 3rd, 2026", "3 oct", "the 3rd of october"
  m = e.match(/^(?:on )?([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/);
  let monthWord: string | undefined;
  let dayNum: number | undefined;
  let yearNum: number | undefined;
  if (m && monthIndex(m[1]) >= 0) {
    monthWord = m[1];
    dayNum = Number(m[2]);
    yearNum = m[3] ? Number(m[3]) : undefined;
  } else {
    const m2 = e.match(/^(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?:,? (\d{4}))?$/);
    if (m2 && monthIndex(m2[2]) >= 0) {
      monthWord = m2[2];
      dayNum = Number(m2[1]);
      yearNum = m2[3] ? Number(m2[3]) : undefined;
    }
  }
  if (monthWord && dayNum) {
    const mo = monthIndex(monthWord) + 1;
    let y = yearNum ?? ty;
    if (!isValidYmd(y, mo, dayNum)) return null;
    // Without an explicit year, a date well in the future means last year.
    if (!yearNum && daysBetween(today, ymd(y, mo, dayNum)) > MAX_FUTURE_DAYS) y -= 1;
    return isValidYmd(y, mo, dayNum) ? ymd(y, mo, dayNum) : null;
  }

  // "on the 3rd", "the 3rd": that day this month, or last month if it's ahead.
  m = e.match(/^(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)$/);
  if (m) {
    const d = Number(m[1]);
    if (d <= td && isValidYmd(ty, tm, d)) return ymd(ty, tm, d);
    const py = tm === 1 ? ty - 1 : ty;
    const pm = tm === 1 ? 12 : tm - 1;
    return isValidYmd(py, pm, d) ? ymd(py, pm, d) : null;
  }

  return null;
}

export type DateCheck = "ok" | "too_old" | "too_far_ahead";

export function checkDateWindow(date: string, today: string): DateCheck {
  const diff = daysBetween(today, date);
  if (diff > MAX_FUTURE_DAYS) return "too_far_ahead";
  if (diff < -MAX_PAST_DAYS) return "too_old";
  return "ok";
}

/** "Today", "Yesterday", "Sep 28", or "Sep 28, 2025" for other years. */
export function dateLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  const base = `${MONTH_LABELS[m - 1]} ${d}`;
  return y === Number(today.slice(0, 4)) ? base : `${base}, ${y}`;
}

/** [first day of month, first day of next month) for the month containing `date`. */
export function monthRange(date: string, offsetMonths = 0): { from: string; to: string } {
  const [y, m] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const end = new Date(Date.UTC(y, m + offsetMonths, 1));
  return { from: fromUtc(start), to: fromUtc(end) };
}

export function monthLabel(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
