import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, NewCategorySchema, slugify } from "./finance-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("has the 12 required defaults", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(12);
    expect(DEFAULT_CATEGORIES).toEqual([
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
    ]);
  });
});

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("Rent / Home")).toBe("rent-home");
    expect(slugify("Debt Payments")).toBe("debt-payments");
    expect(slugify("Groceries")).toBe("groceries");
  });

  it("collapses punctuation and trims leading/trailing hyphens", () => {
    expect(slugify("  Side Hustle!!  ")).toBe("side-hustle");
    expect(slugify("Rent/Home")).toBe("rent-home");
  });

  it("treats case and punctuation variants as the same category", () => {
    // This is what makes duplicate-name detection work: two labels that
    // collide here hit the same unique index row in the DB.
    expect(slugify("groceries")).toBe(slugify("Groceries"));
    expect(slugify("Rent / Home")).toBe(slugify("rent-home"));
  });

  it("returns an empty string for names with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("NewCategorySchema", () => {
  it("rejects empty or whitespace-only names", () => {
    expect(NewCategorySchema.safeParse({ label: "" }).success).toBe(false);
    expect(NewCategorySchema.safeParse({ label: "   " }).success).toBe(false);
  });

  it("rejects names over 60 characters", () => {
    expect(NewCategorySchema.safeParse({ label: "a".repeat(61) }).success).toBe(false);
  });

  it("accepts a reasonable name", () => {
    const result = NewCategorySchema.safeParse({ label: "Side Hustle" });
    expect(result.success).toBe(true);
  });
});
