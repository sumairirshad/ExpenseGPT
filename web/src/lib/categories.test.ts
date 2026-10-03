import { describe, expect, it } from "vitest";
import { categoryLabel } from "./categories";

describe("categoryLabel", () => {
  it("returns the known label for a built-in slug", () => {
    expect(categoryLabel("expense", "groceries")).toBe("Groceries");
    expect(categoryLabel("income", "salary")).toBe("Salary");
  });

  it("humanizes an unknown slug instead of hiding it behind 'Other'", () => {
    // Unknown slugs come from user-created finance categories
    // (src/lib/finance-categories.ts), which categoryLabel doesn't know about.
    expect(categoryLabel("expense", "debt-payments")).toBe("Debt Payments");
    expect(categoryLabel("income", "side-hustle")).toBe("Side Hustle");
  });

  it("falls back to 'Other' for a slug with nothing to humanize", () => {
    expect(categoryLabel("expense", "")).toBe("Other");
  });
});
