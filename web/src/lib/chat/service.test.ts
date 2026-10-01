import { beforeEach, describe, expect, it } from "vitest";
import type { Extractor } from "@/lib/ai/extract";
import { extractWithRules } from "@/lib/ai/rules";
import { emptyExtraction, type Extraction } from "@/lib/ai/schema";
import { createMemoryStore } from "@/test/memory-store";
import { createChatService } from "./service";

const USER = { id: "u1", currency: "PKR", timezone: "Asia/Karachi" };
const rules: Extractor = async (message) => ({ extraction: extractWithRules(message), source: "rules" });

function setup(extract: Extractor = rules) {
  let now = new Date("2026-10-01T12:00:00+05:00"); // Thursday in Karachi
  const clock = () => now;
  const mem = createMemoryStore(USER, clock);
  const service = createChatService({ store: mem.store, extract, now: clock });
  const say = (message: string, requestId?: string) => service.handle({ userId: USER.id, message, requestId });
  return { ...mem, say, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe("recording transactions", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => (t = setup()));

  it("records an expense and confirms it", async () => {
    const reply = await t.say("I spent 850 on dinner");
    expect(reply.status).toBe("saved");
    expect(reply.message).toBe("✓ Added Rs. 850 expense\nFood · Dinner · Today");
    expect(t.transactions).toHaveLength(1);
    expect(t.transactions[0]).toMatchObject({
      type: "expense",
      amountMinor: 85000,
      currency: "PKR",
      category: "food",
      description: "Dinner",
      transactionDate: "2026-10-01",
    });
  });

  it("records income and resolves relative dates in the user's timezone", async () => {
    const reply = await t.say("Got 50,000 salary yesterday");
    expect(reply.message).toBe("✓ Added Rs. 50,000 income\nSalary · Yesterday");
    expect(t.transactions[0]).toMatchObject({ type: "income", amountMinor: 5000000, transactionDate: "2026-09-30" });
  });

  it("asks for a missing amount, then combines the answer", async () => {
    const q = await t.say("I bought groceries");
    expect(q).toMatchObject({ status: "needs_clarification", message: "How much did you spend on groceries?" });
    const a = await t.say("4500");
    expect(a.status).toBe("saved");
    expect(t.transactions[0]).toMatchObject({ amountMinor: 450000, category: "groceries" });
  });

  it("asks what a vague purchase was for", async () => {
    const q = await t.say("Bought something for 500");
    expect(q.message).toBe("What did you spend the Rs. 500 on?");
    await t.say("snacks");
    expect(t.transactions[0]).toMatchObject({ amountMinor: 50000, description: "Snacks", category: "food" });
  });

  it("asks whether a person's payment is income", async () => {
    const q = await t.say("Ali paid me 5000");
    expect(q.message).toContain("Should I record Rs. 5,000 from Ali as income?");
    expect(t.transactions).toHaveLength(0);
    await t.say("income");
    expect(t.transactions[0]).toMatchObject({ type: "income", amountMinor: 500000, person: "Ali" });
  });

  it("does not combine with a stale question", async () => {
    await t.say("I bought groceries");
    t.advance(20 * 60 * 1000);
    const reply = await t.say("4500");
    expect(reply.status).toBe("needs_clarification");
    expect(t.transactions).toHaveLength(0);
  });

  it("a complete new message wins over a pending question", async () => {
    await t.say("I bought groceries");
    await t.say("Spent 200 on tea");
    expect(t.transactions).toHaveLength(1);
    expect(t.transactions[0]).toMatchObject({ amountMinor: 20000, description: "Tea" });
  });

  it("is idempotent per requestId", async () => {
    const a = await t.say("Spent 850 on dinner", "req-1");
    const b = await t.say("Spent 850 on dinner", "req-1");
    expect(b).toEqual(a);
    expect(t.transactions).toHaveLength(1);
  });

  it("rejects dates outside the allowed window", async () => {
    const reply = await t.say("Spent 500 on lunch 2024-01-01");
    expect(reply.status).toBe("needs_clarification");
    expect(t.transactions).toHaveLength(0);
  });
});

describe("answering questions from stored data", () => {
  it("computes balance, monthly and category totals itself", async () => {
    const t = setup();
    await t.say("I got my salary today 150000");
    await t.say("Spent 2500 on groceries");
    await t.say("Paid 1200 electricity bill");
    await t.say("Spent 300 on lunch 2026-09-15"); // last month

    expect((await t.say("How much did I spend this month?")).message).toBe(
      "You've spent Rs. 3,700 this month.\n\nGroceries · Rs. 2,500\nUtilities · Rs. 1,200",
    );
    expect((await t.say("How much money do I have?")).message).toBe("Your current balance is Rs. 146,000.");
    expect((await t.say("How much did I spend on groceries?")).message).toBe(
      "You've spent Rs. 2,500 on Groceries this month.",
    );
    expect((await t.say("How much did I spend last month?")).message).toBe(
      "You've spent Rs. 300 in September.\n\nFood · Rs. 300",
    );
  });

  it("answers empty months gracefully", async () => {
    const t = setup();
    expect((await t.say("How much did I spend this month?")).message).toBe(
      "You haven't recorded any expenses this month yet.",
    );
  });
});

describe("guarding against the AI", () => {
  const fake = (e: Extraction): Extractor => async () => ({ extraction: e, source: "ai" });

  it("never trusts an amount that isn't in the message", async () => {
    const t = setup(fake(emptyExtraction("CREATE_EXPENSE", { amount: 9999, category: "food", description: "Dinner" })));
    const reply = await t.say("I spent 850 on dinner");
    expect(reply.status).toBe("needs_clarification");
    expect(t.transactions).toHaveLength(0);
  });

  it("maps unknown categories to a known one", async () => {
    const t = setup(fake(emptyExtraction("CREATE_EXPENSE", { amount: 850, category: "fine-dining", description: "Dinner" })));
    await t.say("850 dinner");
    expect(t.transactions[0].category).toBe("food");
  });

  it("does the date math itself", async () => {
    const t = setup(
      fake(emptyExtraction("CREATE_EXPENSE", { amount: 450, category: "transport", description: "Uber", date_expression: "last friday" })),
    );
    await t.say("uber 450 last friday");
    expect(t.transactions[0].transactionDate).toBe("2026-09-25");
  });

  it("asks when the date phrase can't be resolved", async () => {
    const t = setup(
      fake(emptyExtraction("CREATE_EXPENSE", { amount: 450, category: "transport", description: "Uber", date_expression: "the other day" })),
    );
    const reply = await t.say("uber 450 the other day");
    expect(reply.message).toContain("Which date was that?");
  });
});
