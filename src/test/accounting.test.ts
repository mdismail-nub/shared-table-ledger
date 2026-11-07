import { describe, expect, it } from "vitest";
import { buildLedger, mealRate, memberBalance } from "@/lib/accounting";

describe("accounting", () => {
  it("meal rate = 30000 / 600 = 50", () => {
    expect(mealRate(30000, 600)).toBe(50);
  });
  it("zero meals gives rate 0", () => {
    expect(mealRate(1000, 0)).toBe(0);
  });
  it("balance = deposits - (meals*rate + shared)", () => {
    expect(memberBalance(3000, 40, 50, 500).balance).toBe(500);
  });
  it("ledger counts breakfast+lunch+dinner and deposits per member; left members skip shared bills", () => {
    const rows = buildLedger(
      [
        { id: "a", status: "active" },
        { id: "b", status: "left" },
      ],
      [
        { member_id: "a", breakfast: 1, lunch: 1, dinner: 1 },
        { member_id: "b", breakfast: 0, lunch: 1, dinner: 0 },
      ],
      [{ member_id: "a", amount: 500 }],
      50,
      100,
    );
    expect(rows[0]).toMatchObject({ meals: 3, deposits: 500, due: 250, balance: 250 });
    expect(rows[1]).toMatchObject({ meals: 1, shared: 0, balance: -50 });
  });
});
