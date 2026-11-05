/** Meal rate uses meal (food/bazar) expenses only — household bills never affect it. Safe for zero meals. */
export function mealRate(foodTotal: number, totalMeals: number): number {
  if (!totalMeals || totalMeals <= 0) return 0;
  return foodTotal / totalMeals;
}

export function memberBalance(deposits: number, meals: number, rate: number, sharedShare: number) {
  const mealCost = meals * rate;
  const due = mealCost + sharedShare;
  return { mealCost, due, balance: deposits - due };
}

type M = { id: string; status: string };
type Ml = { member_id: string; breakfast: number; lunch: number; dinner: number };
type D = { member_id: string; amount: number };

export function buildLedger<T extends M>(members: T[], meals: Ml[], deposits: D[], rate: number, sharedShare: number) {
  return members.map((m) => {
    const mealCount = meals.filter((x) => x.member_id === m.id).reduce((s, x) => s + x.breakfast + x.lunch + x.dinner, 0);
    const paid = deposits.filter((x) => x.member_id === m.id).reduce((s, x) => s + x.amount, 0);
    const share = m.status === "left" ? 0 : sharedShare;
    return { ...m, meals: mealCount, deposits: paid, shared: share, ...memberBalance(paid, mealCount, rate, share) };
  });
}

export const taka = (n: number, digits = 0) =>
  `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
