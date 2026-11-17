import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStoredMess,
  ensureStoredMess,
  addExpenseToStore,
  addPaymentToStore,
  addMemberToStore,
  upsertMealInStore,
  updateMessSettingsInStore,
  regenerateInviteCodeInStore,
  setAdminSession,
  clearAdminSession,
} from "@/lib/mess-store";
import { db } from "@/lib/data";
import { serverSaveRecord } from "@/lib/server-storage.server";
import { cppApi } from "@/lib/api-client";

describe("Mess Context Resolution & Operation Reliability Suite", () => {
  beforeEach(() => {
    try {
      localStorage?.clear?.();
      sessionStorage?.clear?.();
    } catch {
      // ignore
    }
    vi.restoreAllMocks();
  });

  describe("1. Self-healing Store Mutation Methods", () => {
    it("addExpenseToStore creates mess record and does not throw 'Mess not found'", () => {
      const messId = "mess_test_nonexistent_1";
      expect(getStoredMess(messId)).toBeNull();

      const expense = addExpenseToStore(messId, {
        date: "2026-11-17",
        type: "meal",
        category: "Rice",
        amount: 250,
      });

      expect(expense.id).toBeDefined();
      expect(expense.amount).toBe(250);
      const stored = getStoredMess(messId);
      expect(stored).not.toBeNull();
      expect(stored!.expenses).toHaveLength(1);
      expect(stored!.expenses[0]?.amount).toBe(250);
    });

    it("addPaymentToStore creates mess record and does not throw 'Mess not found'", () => {
      const messId = "mess_test_nonexistent_2";
      const payment = addPaymentToStore(messId, {
        date: "2026-11-17",
        member_id: "mem_1",
        amount: 1500,
      });

      expect(payment.id).toBeDefined();
      expect(payment.amount).toBe(1500);
      const stored = getStoredMess(messId);
      expect(stored).not.toBeNull();
      expect(stored!.payments).toHaveLength(1);
    });

    it("addMemberToStore creates mess record and does not throw 'Mess not found'", () => {
      const messId = "mess_test_nonexistent_3";
      const member = addMemberToStore(messId, {
        name: "Test Member",
        room: "101",
      });

      expect(member.id).toBeDefined();
      expect(member.name).toBe("Test Member");
      const stored = getStoredMess(messId);
      expect(stored).not.toBeNull();
      expect(stored!.members).toHaveLength(1);
    });

    it("upsertMealInStore creates mess record and does not throw 'Mess not found'", () => {
      const messId = "mess_test_nonexistent_4";
      const meal = upsertMealInStore(messId, {
        member_id: "mem_1",
        date: "2026-11-17",
        breakfast: 1,
        lunch: 1,
        dinner: 1,
      });

      expect(meal.member_id).toBe("mem_1");
      const stored = getStoredMess(messId);
      expect(stored).not.toBeNull();
      expect(stored!.meals).toHaveLength(1);
    });

    it("updateMessSettingsInStore and regenerateInviteCodeInStore do not throw 'Mess not found'", () => {
      const messId = "mess_test_nonexistent_5";
      const updated = updateMessSettingsInStore(messId, {
        name: "Updated Name",
      });
      expect(updated.name).toBe("Updated Name");

      const code = regenerateInviteCodeInStore(messId);
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe("2. Server Storage self-healing", () => {
    it("serverSaveRecord auto-initializes unknown messId instead of returning 'Mess not found'", () => {
      const res = serverSaveRecord({
        messId: "mess_unknown_server_999",
        table: "mess_expenses",
        action: "insert",
        payload: {
          id: "exp_test_1",
          date: "2026-11-17",
          type: "meal",
          category: "Vegetables",
          amount: 120,
        },
        auth: { userId: "usr_admin", role: "admin" },
      });

      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
    });
  });

  describe("3. Frontend db operations with C++ API delegation", () => {
    it("db.from('mess_expenses').insert dispatches to cppApi when available", async () => {
      const addSpy = vi.spyOn(cppApi.expenses, "add").mockResolvedValue({
        data: { success: true, id: "exp_cpp_mock_123" },
        error: null,
      });

      setAdminSession({
        userId: "usr_admin_1",
        email: "admin@test.com",
        name: "Admin User",
        messId: "mess_cpp_123",
        token: "mock_jwt_token",
        createdAt: "2026-11-17",
      });

      const res = await db.from("mess_expenses").insert({
        date: "2026-11-17",
        type: "meal",
        category: "Groceries",
        amount: 300,
      });

      expect(addSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "Groceries",
          amount: 300,
        })
      );
      expect(res.error).toBeNull();
      expect((res.data as { id: string }).id).toBe("exp_cpp_mock_123");
    });

    it("db.from('payments').insert dispatches to cppApi when available", async () => {
      const recordSpy = vi.spyOn(cppApi.payments, "record").mockResolvedValue({
        data: { success: true, id: "pay_cpp_mock_456" },
        error: null,
      });

      setAdminSession({
        userId: "usr_admin_1",
        email: "admin@test.com",
        name: "Admin User",
        messId: "mess_cpp_123",
        token: "mock_jwt_token",
        createdAt: "2026-11-17",
      });

      const res = await db.from("payments").insert({
        member_id: "mem_2",
        date: "2026-11-17",
        amount: 2000,
      });

      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: "mem_2",
          amount: 2000,
        })
      );
      expect(res.error).toBeNull();
      expect((res.data as { id: string }).id).toBe("pay_cpp_mock_456");
    });

    it("db.from('mess_meals').upsert dispatches to cppApi when available", async () => {
      const upsertSpy = vi.spyOn(cppApi.meals, "upsertDaily").mockResolvedValue({
        data: { success: true, count: 1 },
        error: null,
      });

      setAdminSession({
        userId: "usr_admin_1",
        email: "admin@test.com",
        name: "Admin User",
        messId: "mess_cpp_123",
        token: "mock_jwt_token",
        createdAt: "2026-11-17",
      });

      const res = await db.from("mess_meals").upsert([
        {
          member_id: "mem_2",
          date: "2026-11-17",
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        },
      ]);

      expect(upsertSpy).toHaveBeenCalled();
      expect(res.error).toBeNull();
    });
  });
});
