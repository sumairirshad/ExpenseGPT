import { describe, expect, it } from "vitest";
import { checkDateWindow, dateLabel, monthRange, resolveDate, todayIn } from "./dates";

// Thursday, 1 October 2026
const TODAY = "2026-10-01";

describe("resolveDate", () => {
  it.each([
    [null, "2026-10-01"],
    ["today", "2026-10-01"],
    ["aaj", "2026-10-01"],
    ["yesterday", "2026-09-30"],
    ["kal", "2026-09-30"],
    ["last night", "2026-09-30"],
    ["day before yesterday", "2026-09-29"],
    ["3 days ago", "2026-09-28"],
    ["last friday", "2026-09-25"],
    ["monday", "2026-09-28"],
    ["last thursday", "2026-09-24"],
    ["thursday", "2026-10-01"],
    ["oct 1", "2026-10-01"],
    ["sep 28", "2026-09-28"],
    ["September 3rd", "2026-09-03"],
    ["3 sep", "2026-09-03"],
    ["the 3rd of september", "2026-09-03"],
    ["dec 25", "2025-12-25"], // far future → last year
    ["oct 5", "2026-10-05"], // within the 7-day future window
    ["jan 2, 2026", "2026-01-02"],
    ["the 1st", "2026-10-01"],
    ["on the 15th", "2026-09-15"], // ahead of today → last month
    ["2026-09-12", "2026-09-12"],
  ])("%s → %s", (expr, expected) => {
    expect(resolveDate(expr, TODAY)).toBe(expected);
  });

  it.each(["someday", "2026-02-30", "feb 30", "the 31st"])("rejects %s", (expr) => {
    expect(resolveDate(expr, TODAY)).toBeNull();
  });

  it("wraps across year boundaries", () => {
    expect(resolveDate("yesterday", "2026-01-01")).toBe("2025-12-31");
    expect(resolveDate("the 20th", "2026-01-05")).toBe("2025-12-20");
  });
});

describe("checkDateWindow", () => {
  it("allows up to a year back and a week ahead", () => {
    expect(checkDateWindow("2025-10-01", TODAY)).toBe("ok");
    expect(checkDateWindow("2025-09-30", TODAY)).toBe("too_old");
    expect(checkDateWindow("2026-10-08", TODAY)).toBe("ok");
    expect(checkDateWindow("2026-10-09", TODAY)).toBe("too_far_ahead");
  });
});

describe("dateLabel", () => {
  it("uses friendly labels", () => {
    expect(dateLabel("2026-10-01", TODAY)).toBe("Today");
    expect(dateLabel("2026-09-30", TODAY)).toBe("Yesterday");
    expect(dateLabel("2026-09-28", TODAY)).toBe("Sep 28");
    expect(dateLabel("2025-12-25", TODAY)).toBe("Dec 25, 2025");
  });
});

describe("todayIn / monthRange", () => {
  it("uses the user's timezone, not the server's", () => {
    const lateUtc = new Date("2026-09-30T20:30:00Z"); // 01:30 on Oct 1 in Karachi
    expect(todayIn("Asia/Karachi", lateUtc)).toBe("2026-10-01");
    expect(todayIn("America/New_York", lateUtc)).toBe("2026-09-30");
  });

  it("computes half-open month ranges", () => {
    expect(monthRange(TODAY)).toEqual({ from: "2026-10-01", to: "2026-11-01" });
    expect(monthRange(TODAY, -1)).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(monthRange("2026-01-15", -1)).toEqual({ from: "2025-12-01", to: "2026-01-01" });
  });
});
