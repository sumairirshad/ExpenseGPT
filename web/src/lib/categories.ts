export type TransactionType = "expense" | "income";

export interface Category {
  slug: string;
  label: string;
  type: TransactionType;
  /** Lower-case keywords; see `hasKeyword` for how they match. */
  keywords: string[];
}

// Order matters: the first category with a matching keyword wins, so more
// specific categories (utilities before bills) come first.
export const EXPENSE_CATEGORIES: Category[] = [
  { slug: "utilities", label: "Utilities", type: "expense", keywords: ["electricity", "electric", "gas bill", "sui gas", "water bill", "k-electric", "kelectric", "wapda", "lesco", "iesco"] },
  { slug: "rent", label: "Rent", type: "expense", keywords: ["rent", "kiraya"] },
  { slug: "subscriptions", label: "Subscriptions", type: "expense", keywords: ["netflix", "spotify", "subscription", "youtube premium", "prime video", "icloud", "chatgpt", "claude"] },
  { slug: "groceries", label: "Groceries", type: "expense", keywords: ["grocer", "vegetable", "sabzi", "fruit", "milk", "doodh", "supermarket", "imtiaz", "carrefour", "naheed", "eggs", "atta", "flour", "rice"] },
  { slug: "food", label: "Food", type: "expense", keywords: ["dinner", "lunch", "breakfast", "brunch", "restaurant", "pizza", "burger", "biryani", "karahi", "chai", "tea", "coffee", "snack", "food", "meal", "foodpanda", "kfc", "mcdonald", "shawarma", "dessert", "ice cream", "khana", "nashta"] },
  { slug: "transport", label: "Transport", type: "expense", keywords: ["uber", "careem", "indrive", "yango", "bykea", "taxi", "cab", "rickshaw", "fuel", "petrol", "diesel", "bus", "metro", "train", "parking", "toll"] },
  { slug: "bills", label: "Bills", type: "expense", keywords: ["bill", "internet", "wifi", "ptcl", "mobile", "phone", "recharge", "load", "package", "jazz", "zong", "telenor", "ufone"] },
  { slug: "health", label: "Health", type: "expense", keywords: ["doctor", "medicine", "pharmacy", "hospital", "clinic", "dentist", "lab test", "dawai"] },
  { slug: "education", label: "Education", type: "expense", keywords: ["tuition", "school", "university", "college", "course", "book", "fees", "fee", "stationery"] },
  { slug: "travel", label: "Travel", type: "expense", keywords: ["flight", "hotel", "trip", "airbnb", "ticket", "visa", "vacation", "holiday"] },
  { slug: "entertainment", label: "Entertainment", type: "expense", keywords: ["movie", "cinema", "concert", "game", "gaming", "outing", "party", "event"] },
  { slug: "shopping", label: "Shopping", type: "expense", keywords: ["clothes", "shirt", "shoes", "dress", "shopping", "daraz", "amazon", "mall", "gift", "jeans", "kurta", "watch", "headphones", "laptop"] },
  { slug: "personal", label: "Personal", type: "expense", keywords: ["haircut", "salon", "barber", "gym", "spa", "cosmetic", "skincare", "perfume"] },
  { slug: "business", label: "Business", type: "expense", keywords: ["office", "domain", "hosting", "server", "software", "client meeting", "coworking"] },
  { slug: "other", label: "Other", type: "expense", keywords: [] },
];

export const INCOME_CATEGORIES: Category[] = [
  { slug: "salary", label: "Salary", type: "income", keywords: ["salary", "paycheck", "pay check", "tankhwah", "tankhah", "stipend", "wages"] },
  { slug: "freelance", label: "Freelance", type: "income", keywords: ["freelanc", "client", "fiverr", "upwork", "project", "gig", "contract"] },
  { slug: "business", label: "Business", type: "income", keywords: ["business", "sales", "profit", "shop", "store"] },
  { slug: "gift", label: "Gift", type: "income", keywords: ["gift", "eidi", "present"] },
  { slug: "other", label: "Other", type: "income", keywords: [] },
];

export function categoriesFor(type: TransactionType): Category[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isValidCategory(type: TransactionType, slug: string): boolean {
  return categoriesFor(type).some((c) => c.slug === slug);
}

/** Normalise an AI-proposed category to a known slug; unknown → "other". */
export function normaliseCategory(type: TransactionType, proposed: string | null | undefined): string {
  if (!proposed) return "other";
  const slug = proposed.trim().toLowerCase();
  const match = categoriesFor(type).find((c) => c.slug === slug || c.label.toLowerCase() === slug);
  return match?.slug ?? "other";
}

export function categoryLabel(type: TransactionType, slug: string): string {
  const known = categoriesFor(type).find((c) => c.slug === slug)?.label;
  // Slugs this list doesn't know about come from user-created finance
  // categories (src/lib/finance-categories.ts); humanize rather than hide them.
  return known ?? humanizeSlug(slug);
}

function humanizeSlug(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  return words.length > 0 ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Other";
}

// Keywords of 5+ letters match as word prefixes ("grocer" → "groceries");
// shorter ones must be the whole word, plus an optional plural ("tea" ≠ "team").
function hasKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = keyword.length >= 5 ? "" : "(?:s|es)?\\b";
  return new RegExp(`\\b${escaped}${tail}`, "i").test(text);
}

export function guessCategory(type: TransactionType, text: string): string | null {
  for (const c of categoriesFor(type)) {
    if (c.keywords.some((k) => hasKeyword(text, k))) return c.slug;
  }
  return null;
}

/** Find an expense category the user mentioned by name or keyword (for queries). */
export function findMentionedCategory(text: string): string | null {
  for (const c of EXPENSE_CATEGORIES) {
    if (c.slug === "other") continue;
    if (hasKeyword(text, c.slug) || hasKeyword(text, c.label.toLowerCase())) return c.slug;
  }
  return guessCategory("expense", text);
}
