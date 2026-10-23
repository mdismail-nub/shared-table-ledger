import { describe, expect, it } from "vitest";
import { mealRate, memberBalance, type Expense } from "@/lib/accounting";

const e = (type: Expense["type"], amount: number): Expense => ({
  id: String(Math.random()), date: "", type, category: "", description: "", amount, memberId: "", method: "",
});

describe("accounting", () => {
  it("meal rate = 30000 / 600 = 50", () => {
    expect(mealRate([e("meal", 30000)], 600)).toBe(50);
  });
  it("household bills never increase meal rate", () => {
    expect(mealRate([e("meal", 30000), e("household", 5000)], 600)).toBe(50);
  });
  it("zero meals gives rate 0", () => {
    expect(mealRate([e("meal", 1000)], 0)).toBe(0);
  });
  it("balance = deposits - (meals*rate + shared)", () => {
    expect(memberBalance(3000, 40, 50, 500).balance).toBe(500);
  });
});
