import { describe, expect, it } from "vitest";
import { extractWithRules } from "./rules";

describe("extractWithRules: expenses", () => {
  // Every phrasing from the spec should land on the same transaction.
  it.each(["850 dinner", "Spent 850 on dinner", "I spent 850 on dinner", "Paid 850 for dinner", "Dinner cost me 850", "850 ka dinner"])(
    "%s",
    (msg) => {
      expect(extractWithRules(msg)).toMatchObject({
        intent: "CREATE_EXPENSE",
        amount: 850,
        category: "food",
        description: "Dinner",
        missing: [],
      });
    },
  );

  it.each([
    ["I paid 3,000 electricity bill yesterday", { amount: 3000, category: "utilities", description: "Electricity bill", date_expression: "yesterday" }],
    ["Spent 2500 on groceries", { amount: 2500, category: "groceries", description: "Groceries" }],
    ["Uber 450", { amount: 450, category: "transport", description: "Uber" }],
    ["spent 1.5k on uber last friday", { amount: 1500, category: "transport", date_expression: "last friday" }],
    ["kal 500 ki chai", { amount: 500, category: "food", description: "Chai", date_expression: "kal" }],
    ["Rent 40000 on the 1st", { amount: 40000, category: "rent", date_expression: "the 1st" }],
    ["Bought shoes for 4500 on oct 3", { amount: 4500, category: "shopping", description: "Shoes", date_expression: "oct 3" }],
  ])("%s", (msg, expected) => {
    expect(extractWithRules(msg)).toMatchObject({ intent: "CREATE_EXPENSE", ...expected });
  });
});

describe("extractWithRules: income", () => {
  it.each([
    ["Got 50,000 salary today", 50000, "salary"],
    ["I got my salary today 150000", 150000, "salary"],
    ["Received 20k from freelancing", 20000, "freelance"],
    ["Client paid me 100,000", 100000, "freelance"],
  ])("%s", (msg, amount, category) => {
    expect(extractWithRules(msg)).toMatchObject({ intent: "CREATE_INCOME", amount, category, missing: [] });
  });

  it("asks whether a person paying you is income or a repayment", () => {
    expect(extractWithRules("Ali paid me 5,000")).toMatchObject({
      intent: "CLARIFY",
      amount: 5000,
      person: "Ali",
      missing: ["type"],
    });
  });

  it("records it as income once the user says so", () => {
    expect(extractWithRules("Ali paid me 5,000. income")).toMatchObject({
      intent: "CREATE_INCOME",
      amount: 5000,
      person: "Ali",
      description: "From Ali",
    });
  });
});

describe("extractWithRules: missing information", () => {
  it("asks what a vague purchase was", () => {
    expect(extractWithRules("Bought something for 500")).toMatchObject({
      intent: "CREATE_EXPENSE",
      amount: 500,
      missing: ["description"],
    });
  });

  it("asks for the amount", () => {
    expect(extractWithRules("I bought groceries")).toMatchObject({
      intent: "CREATE_EXPENSE",
      amount: null,
      category: "groceries",
      missing: ["amount"],
    });
  });

  it("refuses to pick between two amounts", () => {
    expect(extractWithRules("200 lunch 300 dinner").intent).toBe("CLARIFY");
  });
});

describe("extractWithRules: queries and others", () => {
  it.each([
    ["How much did I spend this month?", { intent: "GET_MONTHLY_TOTAL", period: "current_month" }],
    ["How much did I spend last month?", { intent: "GET_MONTHLY_TOTAL", period: "last_month" }],
    ["How much did I spend on food?", { intent: "GET_CATEGORY_TOTAL", category: "food" }],
    ["How much money do I have?", { intent: "GET_BALANCE" }],
    ["what's my balance", { intent: "GET_BALANCE" }],
    ["Ali owes me 5000", { intent: "UNSUPPORTED" }],
    ["I owe Ahmed 3000", { intent: "UNSUPPORTED" }],
    ["hello", { intent: "SMALLTALK" }],
    ["", { intent: "SMALLTALK" }],
  ])("%s", (msg, expected) => {
    expect(extractWithRules(msg)).toMatchObject(expected);
  });
});
