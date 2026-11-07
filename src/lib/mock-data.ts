import { mealRate, memberBalance, sumByType, type Expense } from "./accounting";

export interface Member {
  id: string;
  name: string;
  phone: string;
  room: string;
  joined: string;
  status: "active" | "left" | "new";
  meals: number;
  deposits: number;
  tone: "primary" | "mint" | "peach" | "lime" | "cyan";
}

export const members: Member[] = [
  {
    id: "m1",
    name: "Rahim Uddin",
    phone: "01711-234567",
    room: "A-1",
    joined: "2025-01-04",
    status: "active",
    meals: 82,
    deposits: 5000,
    tone: "primary",
  },
  {
    id: "m2",
    name: "Ayesha Khan",
    phone: "01822-345678",
    room: "A-2",
    joined: "2025-03-11",
    status: "active",
    meals: 74,
    deposits: 3500,
    tone: "mint",
  },
  {
    id: "m3",
    name: "Tanvir Hasan",
    phone: "01933-456789",
    room: "B-1",
    joined: "2025-06-20",
    status: "active",
    meals: 68,
    deposits: 4500,
    tone: "peach",
  },
  {
    id: "m4",
    name: "Nusrat Jahan",
    phone: "01644-567890",
    room: "B-2",
    joined: "2025-08-02",
    status: "active",
    meals: 79,
    deposits: 4000,
    tone: "lime",
  },
  {
    id: "m5",
    name: "Sakib Ahmed",
    phone: "01555-678901",
    room: "C-1",
    joined: "2026-10-12",
    status: "new",
    meals: 36,
    deposits: 2000,
    tone: "cyan",
  },
  {
    id: "m6",
    name: "Farhan Islam",
    phone: "01366-789012",
    room: "C-2",
    joined: "2024-11-15",
    status: "active",
    meals: 61,
    deposits: 3000,
    tone: "primary",
  },
];

export const expenses: Expense[] = [
  {
    id: "e1",
    date: "2026-10-22",
    type: "meal",
    category: "Fish & meat",
    description: "Rui fish 3kg, chicken 2kg",
    amount: 2450,
    memberId: "m1",
    method: "Cash",
  },
  {
    id: "e2",
    date: "2026-10-21",
    type: "meal",
    category: "Vegetables",
    description: "Weekly vegetables",
    amount: 980,
    memberId: "m2",
    method: "bKash",
  },
  {
    id: "e3",
    date: "2026-10-20",
    type: "household",
    category: "Wi-Fi",
    description: "October internet bill",
    amount: 1500,
    memberId: "m4",
    method: "Bank",
  },
  {
    id: "e4",
    date: "2026-10-19",
    type: "meal",
    category: "Rice",
    description: "Miniket rice 25kg",
    amount: 1950,
    memberId: "m3",
    method: "Cash",
  },
  {
    id: "e5",
    date: "2026-10-18",
    type: "household",
    category: "Electricity",
    description: "DESCO prepaid recharge",
    amount: 2200,
    memberId: "m1",
    method: "bKash",
  },
  {
    id: "e6",
    date: "2026-10-16",
    type: "meal",
    category: "Eggs",
    description: "4 dozen eggs",
    amount: 720,
    memberId: "m6",
    method: "Cash",
  },
  {
    id: "e7",
    date: "2026-10-14",
    type: "meal",
    category: "Cooking oil",
    description: "Soybean oil 5L",
    amount: 920,
    memberId: "m2",
    method: "Nagad",
  },
  {
    id: "e8",
    date: "2026-10-12",
    type: "household",
    category: "Gas",
    description: "Gas cylinder refill",
    amount: 1450,
    memberId: "m3",
    method: "Cash",
  },
  {
    id: "e9",
    date: "2026-10-10",
    type: "meal",
    category: "Spices",
    description: "Monthly masala",
    amount: 640,
    memberId: "m4",
    method: "Cash",
  },
  {
    id: "e10",
    date: "2026-10-08",
    type: "meal",
    category: "Fish & meat",
    description: "Beef 2kg",
    amount: 1560,
    memberId: "m1",
    method: "Cash",
  },
  {
    id: "e11",
    date: "2026-10-05",
    type: "household",
    category: "Cleaning",
    description: "Detergent, mop, phenyl",
    amount: 450,
    memberId: "m6",
    method: "Cash",
  },
  {
    id: "e12",
    date: "2026-10-03",
    type: "meal",
    category: "Vegetables",
    description: "Bazar run",
    amount: 1240,
    memberId: "m5",
    method: "bKash",
  },
  {
    id: "e13",
    date: "2026-10-01",
    type: "meal",
    category: "Rice",
    description: "Rice & lentils",
    amount: 2470,
    memberId: "m3",
    method: "Cash",
  },
];

export interface Deposit {
  id: string;
  date: string;
  memberId: string;
  amount: number;
  method: "Cash" | "bKash" | "Nagad" | "Bank";
  kind: "Deposit" | "Advance" | "Refund";
}

export const deposits: Deposit[] = [
  { id: "d1", date: "2026-10-22", memberId: "m4", amount: 1000, method: "bKash", kind: "Deposit" },
  { id: "d2", date: "2026-10-20", memberId: "m1", amount: 2000, method: "Bank", kind: "Deposit" },
  { id: "d3", date: "2026-10-15", memberId: "m5", amount: 2000, method: "Cash", kind: "Advance" },
  { id: "d4", date: "2026-10-12", memberId: "m3", amount: 1500, method: "Nagad", kind: "Deposit" },
  { id: "d5", date: "2026-10-08", memberId: "m2", amount: 3500, method: "bKash", kind: "Deposit" },
  { id: "d6", date: "2026-10-05", memberId: "m6", amount: 3000, method: "Cash", kind: "Deposit" },
  { id: "d7", date: "2026-10-02", memberId: "m1", amount: 3000, method: "Cash", kind: "Deposit" },
  { id: "d8", date: "2026-10-01", memberId: "m3", amount: 3000, method: "Bank", kind: "Deposit" },
  { id: "d9", date: "2026-10-01", memberId: "m4", amount: 3000, method: "Cash", kind: "Deposit" },
];

export const memberById = (id: string) => members.find((m) => m.id === id)!;

export const totalMeals = members.reduce((s, m) => s + m.meals, 0);
export const foodTotal = sumByType(expenses, "meal");
export const householdTotal = sumByType(expenses, "household");
export const rate = mealRate(foodTotal, totalMeals);
export const depositTotal = members.reduce((s, m) => s + m.deposits, 0);
export const sharedShare = householdTotal / members.length;

export const ledger = members.map((m) => ({
  ...m,
  ...memberBalance(m.deposits, m.meals, rate, sharedShare),
  shared: sharedShare,
}));
export const outstanding = ledger.filter((l) => l.balance < 0).reduce((s, l) => s + l.balance, 0);

export const dailySpend = Array.from({ length: 22 }, (_, i) => {
  const day = i + 1;
  const d = `2026-10-${String(day).padStart(2, "0")}`;
  const food = expenses
    .filter((e) => e.date === d && e.type === "meal")
    .reduce((s, e) => s + e.amount, 0);
  const home = expenses
    .filter((e) => e.date === d && e.type === "household")
    .reduce((s, e) => s + e.amount, 0);
  return { day: String(day), food: food || 150 + ((day * 37) % 260), household: home };
});

export const monthlyTrend = [
  { month: "May", food: 15800, household: 5200, deposits: 22000 },
  { month: "Jun", food: 16900, household: 5400, deposits: 21500 },
  { month: "Jul", food: 15100, household: 5900, deposits: 23000 },
  { month: "Aug", food: 17400, household: 5600, deposits: 22800 },
  { month: "Sep", food: 16200, household: 5800, deposits: 21000 },
  { month: "Oct", food: foodTotal, household: householdTotal, deposits: depositTotal },
];

export const categoryBreakdown = Object.entries(
  expenses.reduce<Record<string, number>>(
    (acc, e) => ((acc[e.category] = (acc[e.category] ?? 0) + e.amount), acc),
    {},
  ),
)
  .map(([name, value]) => ({ name, value, type: expenses.find((e) => e.category === name)!.type }))
  .sort((a, b) => b.value - a.value);

export const mealCategories = [
  "Rice",
  "Vegetables",
  "Fish & meat",
  "Eggs",
  "Cooking oil",
  "Spices",
  "Other food",
];
export const householdCategories = [
  "Wi-Fi",
  "Electricity",
  "Gas",
  "Water",
  "Cleaning",
  "Other household",
];

export type Activity = {
  id: string;
  kind: "bazar" | "deposit" | "meal" | "bill" | "adjust";
  title: string;
  memberId: string;
  amount?: number;
  date: string;
};
export const activity: Activity[] = [
  {
    id: "a1",
    kind: "bazar",
    title: "Fish & meat bazar",
    memberId: "m1",
    amount: 2450,
    date: "Today, 10:20",
  },
  {
    id: "a2",
    kind: "deposit",
    title: "Deposit via bKash",
    memberId: "m4",
    amount: 1000,
    date: "Today, 09:05",
  },
  {
    id: "a3",
    kind: "meal",
    title: "Meals updated for 6 members",
    memberId: "m1",
    date: "Yesterday, 22:10",
  },
  {
    id: "a4",
    kind: "bill",
    title: "Wi-Fi bill paid",
    memberId: "m4",
    amount: 1500,
    date: "Oct 20",
  },
  { id: "a5", kind: "adjust", title: "Corrected lunch count", memberId: "m2", date: "Oct 19" },
];
