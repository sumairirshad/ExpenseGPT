import { findMentionedCategory, guessCategory, categoryLabel, type TransactionType } from "@/lib/categories";
import { DATE_PHRASE_RE } from "@/lib/dates";
import { findAmounts } from "@/lib/money";
import { emptyExtraction, type Extraction, type Period } from "./schema";

// Deterministic extractor. Runs when no AI key is configured and as the
// fallback when the AI call fails. Covers the common phrasings in the spec;
// anything it can't place becomes a clarifying question, never a guess.

const DEBT_RE = /\b(owes? me|i owe|lent|borrowed|loan|udhaa?r|repay\w*|paying (me )?back|pay (me )?back)\b/i;
const GREETING_RE = /^(hi|hello|hey|salam|assalam\w*|aoa|thanks|thank you|shukriya|help|\?)\b/i;
const BALANCE_RE = /\b(balance|how much (money )?(do i have|have i got|is left|do i have left)|kitne paise|money left)\b/i;
const SPEND_QUERY_RE = /\b(how much|total|kitna|kitne|what did i)\b.*\b(spen[dt]|spending|expenses?|kharch\w*)\b/i;
const INCOME_QUERY_RE = /\b(how much|total|kitna|kitne)\b.*\b(earn\w*|income|made|received)\b/i;
const STRONG_INCOME_RE = /\b(salary|received|recieved|earned|income|paid me|bonus|freelanc\w*|credited|tankhwa?h|pay ?check|stipend|wages|eidi)\b/i;
const GOT_FROM_RE = /\bgot\b.*\bfrom\b/i;
const EXPENSE_VERB_RE = /\b(spent|spend|paid|pay|bought|buy|purchased|cost|costs|kharch\w*|liya|li|diya)\b/i;
// "<name> paid me": a person repaying is not income. Generic payers are fine.
const PERSON_PAID_ME_RE = /^\s*([a-z][a-z'-]+)\s+(?:paid|sent|gave|transferred)\s+me\b/i;
const GENERIC_PAYERS = new Set(["client", "company", "boss", "employer", "office", "work", "customer", "someone", "i", "he", "she", "they", "my"]);

const FILLER = new Set([
  "i", "i've", "ive", "i'm", "im", "me", "my", "mine", "we", "our",
  "spent", "spend", "spending", "paid", "pay", "payed", "for", "on", "a", "an", "the", "of", "in",
  "bought", "buy", "purchased", "purchase", "cost", "costs", "rs", "rs.", "pkr", "rupees", "rupee",
  "received", "recieved", "receive", "got", "get", "earned", "earn", "from", "to", "at", "was", "is", "it",
  "and", "just", "some", "worth", "with", "today", "tonight", "yesterday", "this", "that", "total",
  "ka", "ki", "ke", "pe", "par", "mein", "main", "maine", "ne", "kiya", "liya", "li", "diya", "di",
  "sent", "gave", "transferred", "credited", "add", "added", "record", "log", "expense", "income",
  "please", "pls", "money", "cash", "amount", "of", "lol", "bhi", "my", "as",
]);
const VAGUE = new Set(["something", "stuff", "thing", "things", "item", "items", "kuch", "cheez", "saman"]);

function cleanDescription(text: string): string | null {
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w.toLowerCase()) && !VAGUE.has(w.toLowerCase()));
  if (words.length === 0) return null;
  const phrase = words.join(" ").toLowerCase();
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function queryPeriod(text: string): Period {
  if (/\blast month\b|\bpichl[ae] mah\w*/i.test(text)) return "last_month";
  if (/\b(ever|all time|overall|so far in total)\b/i.test(text)) return "all_time";
  return "current_month";
}

export function extractWithRules(message: string): Extraction {
  const text = message.trim();
  if (!text) return emptyExtraction("SMALLTALK");

  const amounts = findAmounts(text.replace(DATE_PHRASE_RE, " "));

  if (DEBT_RE.test(text)) return emptyExtraction("UNSUPPORTED");

  // Questions are answered from the database, never recorded.
  if (amounts.length === 0) {
    if (BALANCE_RE.test(text)) return emptyExtraction("GET_BALANCE");
    if (SPEND_QUERY_RE.test(text)) {
      const category = findMentionedCategory(text.replace(SPEND_QUERY_RE, " "));
      return category
        ? emptyExtraction("GET_CATEGORY_TOTAL", { category, period: queryPeriod(text) })
        : emptyExtraction("GET_MONTHLY_TOTAL", { period: queryPeriod(text) });
    }
    if (INCOME_QUERY_RE.test(text) || text.trim().endsWith("?")) return emptyExtraction("UNSUPPORTED");
    if (GREETING_RE.test(text)) return emptyExtraction("SMALLTALK");
  }

  // Pull out the date phrase and the amount so neither pollutes the description.
  const dateMatch = text.match(DATE_PHRASE_RE);
  const dateExpression = dateMatch ? dateMatch[0].replace(/^on\s+/i, "") : null;
  const withoutDate = dateMatch ? text.replace(dateMatch[0], " ") : text;
  const amountMatches = findAmounts(withoutDate);
  const distinct = [...new Set(amountMatches.map((a) => a.value))];

  const personPaid = withoutDate.match(PERSON_PAID_ME_RE);
  const person = personPaid && !GENERIC_PAYERS.has(personPaid[1].toLowerCase())
    ? personPaid[1].charAt(0).toUpperCase() + personPaid[1].slice(1).toLowerCase()
    : null;

  const explicitIncome = /\bincome\b/i.test(withoutDate);
  const isIncome =
    explicitIncome ||
    ((STRONG_INCOME_RE.test(withoutDate) || GOT_FROM_RE.test(withoutDate)) && !EXPENSE_VERB_RE.test(withoutDate.replace(/\bpaid me\b/i, "")));
  const type: TransactionType = isIncome ? "income" : "expense";

  let rest = withoutDate;
  for (const a of [...amountMatches].reverse()) rest = rest.slice(0, a.start) + " " + rest.slice(a.end);
  if (person) rest = rest.replace(new RegExp(`\\b${personPaid![1]}\\b`, "i"), " ");
  let description = cleanDescription(rest);
  const category = guessCategory(type, `${rest} ${withoutDate}`);

  if (type === "income" && !description) {
    description = person ? `From ${person}` : category ? categoryLabel("income", category) : "Income";
  }

  const base = {
    amount: distinct.length === 1 ? distinct[0] : null,
    category,
    description,
    person,
    date_expression: dateExpression,
  };

  if (distinct.length > 1) {
    return emptyExtraction("CLARIFY", {
      ...base,
      clarification: "I found more than one amount there. Could you send one transaction at a time?",
    });
  }

  // "Ali paid me 5000": ask whether it is income or a repayment.
  if (person && type === "income" && !explicitIncome) {
    return emptyExtraction("CLARIFY", { ...base, missing: ["type"] });
  }

  const intent = type === "income" ? "CREATE_INCOME" : "CREATE_EXPENSE";
  const missing: Extraction["missing"] = [];
  if (base.amount === null) missing.push("amount");
  if (!description) missing.push("description");

  if (missing.length > 0) {
    // Nothing transaction-like at all → don't pester with "how much?".
    if (base.amount === null && !EXPENSE_VERB_RE.test(text) && !isIncome && !category) {
      return emptyExtraction("SMALLTALK");
    }
    return emptyExtraction(intent, { ...base, missing });
  }

  return emptyExtraction(intent, base);
}
