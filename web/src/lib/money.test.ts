import { describe, expect, it } from "vitest";
import { formatMoney, formatSigned, parseAmounts, toMinor } from "./money";

describe("parseAmounts", () => {
  it.each([
    ["850 dinner", [850]],
    ["Got 50,000 salary", [50000]],
    ["Rs. 1,250.50 for books", [1250.5]],
    ["rs500 chai", [500]],
    ["5k uber", [5000]],
    ["1.5k on uber", [1500]],
    ["2 lakh rent", [200000]],
    ["1.2m bonus", [1200000]],
    ["1 crore", [10000000]],
    ["paid 3000 on the 3rd", [3000]],
    ["no amount here", []],
    ["500 and 500", [500]],
    ["200 then 300", [200, 300]],
  ])("%s", (text, expected) => {
    expect(parseAmounts(text)).toEqual(expected);
  });

  it("does not read ordinals or glued words as amounts", () => {
    expect(parseAmounts("on the 21st")).toEqual([]);
    expect(parseAmounts("abc123")).toEqual([]);
  });
});

describe("formatMoney", () => {
  it("formats PKR with grouping and no decimals for whole amounts", () => {
    expect(formatMoney(toMinor(150000))).toBe("Rs. 150,000");
    expect(formatMoney(toMinor(850))).toBe("Rs. 850");
  });

  it("shows decimals only when needed", () => {
    expect(formatMoney(125050)).toBe("Rs. 1,250.50");
  });

  it("handles negatives and other currencies", () => {
    expect(formatMoney(-85000)).toBe("-Rs. 850");
    expect(formatMoney(1999, "USD")).toBe("$19.99");
  });

  it("formats signed list amounts", () => {
    expect(formatSigned(85000, "expense")).toBe("-850");
    expect(formatSigned(15000000, "income")).toBe("+150,000");
  });
});

describe("toMinor", () => {
  it("avoids float drift", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(1250.5)).toBe(125050);
  });
});
