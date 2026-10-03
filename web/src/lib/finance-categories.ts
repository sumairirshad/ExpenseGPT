import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { categories } from "@/db/schema";
import { isUniqueViolation } from "@/lib/chat/drizzle-store";

// These 12 are seeded for every user the first time their categories are
// read; order here is the display order for defaults.
export const DEFAULT_CATEGORIES = [
  "Income",
  "Savings",
  "Rent / Home",
  "Utilities",
  "Groceries",
  "Transportation",
  "Healthcare",
  "Insurance",
  "Debt Payments",
  "Shopping",
  "Entertainment",
  "Investments",
] as const;

export interface CategoryView {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
}

export const NewCategorySchema = z.object({
  label: z.string().trim().min(1, "Category name is required").max(60),
});

/** Lower-case, hyphenated; two labels that only differ in case/punctuation collide on purpose. */
export function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureDefaultCategories(db: Db, userId: string): Promise<void> {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((label) => ({ userId, slug: slugify(label), label, isDefault: true })))
    .onConflictDoNothing();
}

export async function listCategories(db: Db, userId: string): Promise<CategoryView[]> {
  await ensureDefaultCategories(db, userId);
  const rows = await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.createdAt));
  return rows.map(toView);
}

export type CreateCategoryResult =
  | { ok: true; category: CategoryView }
  | { ok: false; error: "duplicate" | "invalid" };

export async function createCategory(db: Db, userId: string, label: string): Promise<CreateCategoryResult> {
  const trimmed = label.trim();
  const slug = slugify(trimmed);
  if (!slug) return { ok: false, error: "invalid" };
  try {
    const [row] = await db.insert(categories).values({ userId, slug, label: trimmed }).returning();
    return { ok: true, category: toView(row) };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate" };
    throw err;
  }
}

function toView(row: typeof categories.$inferSelect): CategoryView {
  return { id: row.id, slug: row.slug, label: row.label, isDefault: row.isDefault };
}
