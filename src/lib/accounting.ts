export type ExpenseType = "meal" | "household";

export interface Expense {
  id: string;
  date: string;
  type: ExpenseType;
  category: string;
  description: string;
  amount: number;
  memberId: string;
  method: string;
}

/** Meal rate uses meal expenses only — household bills never affect it. Safe for zero meals. */
export function mealRate(expenses: Expense[], totalMeals: number): number {
  if (!totalMeals || totalMeals <= 0) return 0;
  const food = expenses.filter((e) => e.type === "meal").reduce((s, e) => s + e.amount, 0);
  return food / totalMeals;
}

export function sumByType(expenses: Expense[], type: ExpenseType) {
  return expenses.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);
}

export function memberBalance(deposits: number, meals: number, rate: number, sharedShare: number) {
  const mealCost = meals * rate;
  const due = mealCost + sharedShare;
  return { mealCost, due, balance: deposits - due };
}

export const taka = (n: number, digits = 0) =>
  `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
