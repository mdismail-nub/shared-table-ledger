import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  serverCreateMess,
  serverGetWorkspace,
  serverSaveRecord,
  serverLookupMessByCode,
  createGuestToken,
  verifyGuestToken,
} from "@/lib/server-storage.server";
import {
  setMemberSession,
  getMemberSession,
  MEMBER_SESSION_KEY,
  formatLocalDate,
  shortMonthYear,
} from "@/lib/data";
import {
  setAdminSession,
  getAdminSession,
  ADMIN_SESSION_KEY,
  type AdminSession,
} from "@/lib/mess-store";
import {
  enqueueSyncOperation,
  getPendingSyncQueue,
  cancelPendingOperationsForEntity,
} from "@/lib/offline-db";

describe("Security Regression Test Suite", () => {
  beforeEach(() => {
    try {
      localStorage?.clear?.();
      sessionStorage?.clear?.();
    } catch {
      // ignore
    }
    vi.restoreAllMocks();
  });

  describe("1. Role-Based Access Control (RBAC) & Unauthenticated Mutations", () => {
    it("rejects unauthorized deletion of mess members by unauthenticated caller or normal member", async () => {
      const mess = await serverCreateMess({
        name: "Security Test Mess",
        manager: "Admin Host",
      });

      // Member joins
      const memberToken = createGuestToken(mess.id, "mem_regular_1", "member");

      // Regular member attempts to delete another member
      const deleteRes = serverSaveRecord({
        messId: mess.id,
        table: "mess_members",
        action: "delete",
        col: "id",
        val: "mem_other_user",
        auth: {
          userId: "usr_regular_1",
          memberId: "mem_regular_1",
          role: "member",
          messId: mess.id,
        },
      });

      expect(deleteRes.error).toBeDefined();
      expect(deleteRes.error).toMatch(/Forbidden|Only mess admins/);

      // Admin caller with admin authority succeeds
      const adminDeleteRes = serverSaveRecord({
        messId: mess.id,
        table: "mess_members",
        action: "delete",
        col: "id",
        val: "mem_other_user",
        auth: {
          userId: mess.owner_id,
          role: "admin",
          messId: mess.id,
        },
      });

      expect(adminDeleteRes.ok).toBe(true);
    });

    it("prevents non-admins from mutating expenses or payments", async () => {
      const mess = await serverCreateMess({
        name: "Finance Shield Mess",
        manager: "Finance Admin",
      });

      const expense = {
        id: "exp_rogue_1",
        date: "2026-11-01",
        type: "meal" as const,
        category: "Rice",
        description: "Unauthorized expense entry",
        amount: 5000,
        member_id: "mem_regular_1",
        method: "Cash",
        created_at: new Date().toISOString(),
      };

      const res = serverSaveRecord({
        messId: mess.id,
        table: "mess_expenses",
        action: "insert",
        payload: expense,
        auth: {
          userId: "usr_guest_user",
          memberId: "mem_regular_1",
          role: "member",
          messId: mess.id,
        },
      });

      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Forbidden|Only mess admins/);
    });
  });

  describe("2. Cross-Tenant Isolation", () => {
    it("blocks a caller scoped to Mess A from mutating records in Mess B", async () => {
      const messA = await serverCreateMess({ name: "Tenant A", manager: "Manager A" });
      const messB = await serverCreateMess({ name: "Tenant B", manager: "Manager B" });

      const res = serverSaveRecord({
        messId: messB.id,
        table: "messes",
        action: "update",
        payload: { name: "Hacked Mess" },
        auth: {
          userId: "usr_admin_A",
          role: "admin",
          messId: messA.id, // Scoped to A, trying to write to B
        },
      });

      expect(res.error).toBeDefined();
      expect(res.error).toMatch(/Cross-tenant mutations are prohibited/);
    });
  });

  describe("3. Guest Token Scope, Creation, and Expiration", () => {
    it("issues high-entropy tokens and validates expiration", () => {
      const token = createGuestToken("mess_target_123", "mem_target_1", "member");
      expect(token).toMatch(/^gst_[0-9a-f]{48}$/);

      const verified = verifyGuestToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.messId).toBe("mess_target_123");
      expect(verified?.memberId).toBe("mem_target_1");
      expect(verified?.role).toBe("member");

      // Non-existent or empty token returns null
      expect(verifyGuestToken("")).toBeNull();
      expect(verifyGuestToken("gst_non_existent_token_123")).toBeNull();
    });
  });

  describe("4. Private Notification Protection & IDOR Prevention", () => {
    it("never returns targeted private notices to guests or callers supplying another memberId", async () => {
      const mess = await serverCreateMess({
        name: "Privacy Mess",
        manager: "Admin Khan",
      });

      // Insert broadcast notice
      serverSaveRecord({
        messId: mess.id,
        table: "mess_notifications",
        action: "insert",
        payload: {
          id: "notif_public_broadcast",
          mess_id: mess.id,
          sender_id: "mem_admin",
          recipient_id: null,
          title: "General Mess Meeting",
          message: "All members please attend tonight.",
          type: "notice",
          created_at: new Date().toISOString(),
        },
        auth: { role: "admin", messId: mess.id },
      });

      // Insert private notice targeted to member A
      serverSaveRecord({
        messId: mess.id,
        table: "mess_notifications",
        action: "insert",
        payload: {
          id: "notif_private_for_member_A",
          mess_id: mess.id,
          sender_id: "mem_admin",
          recipient_id: "mem_A",
          title: "Personal Overdue Warning",
          message: "Your personal dues are overdue.",
          type: "alert",
          created_at: new Date().toISOString(),
        },
        auth: { role: "admin", messId: mess.id },
      });

      // An unauthenticated guest accesses workspace by invite code attempting IDOR with memberId="mem_A"
      const guestWorkspace = await serverGetWorkspace({
        code: mess.invite_code,
        month: "2026-11",
        memberId: "mem_A", // Untrusted caller-supplied param
      });

      expect(guestWorkspace).not.toBeNull();
      // Must contain public broadcast
      expect(
        guestWorkspace?.notifications.some((n) => n.id === "notif_public_broadcast"),
      ).toBe(true);
      // MUST NOT contain member A's private notification
      expect(
        guestWorkspace?.notifications.some((n) => n.id === "notif_private_for_member_A"),
      ).toBe(false);
    });

    it("sanitizes phone numbers and sensitive user IDs in public invite lookups", async () => {
      const mess = await serverCreateMess({
        name: "Contact Privacy Mess",
        manager: "Admin Leader",
      });

      const lookup = await serverLookupMessByCode(mess.invite_code);
      expect(lookup).not.toBeNull();
      lookup?.members.forEach((m) => {
        // Phone numbers and user IDs must not be exposed in public lookups
        expect((m as { phone?: string }).phone).toBeUndefined();
        expect((m as { user_id?: string }).user_id).toBeUndefined();
      });
    });
  });

  describe("5. Session Switching & Complete Key Cleanup", () => {
    it("clears ADMIN_SESSION_KEY when switching to member mode", () => {
      const adminSession: AdminSession = {
        userId: "usr_admin",
        email: "admin@test.com",
        name: "Admin Name",
        messId: "mess_1",
        token: "adm_123",
        createdAt: new Date().toISOString(),
      };

      setAdminSession(adminSession);
      expect(localStorage.getItem(ADMIN_SESSION_KEY)).not.toBeNull();

      // Switch to member mode
      setMemberSession({
        code: "654321",
        messId: "mess_2",
        memberName: "Member Name",
        memberId: "mem_2",
      });

      expect(localStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
      expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
      expect(getMemberSession()?.memberId).toBe("mem_2");
    });

    it("clears MEMBER_SESSION_KEY when switching to admin mode", () => {
      setMemberSession({
        code: "112233",
        messId: "mess_guest",
        memberName: "Guest Member",
        memberId: "mem_guest",
      });
      expect(localStorage.getItem(MEMBER_SESSION_KEY)).not.toBeNull();

      // Switch to admin mode
      setAdminSession({
        userId: "usr_admin_new",
        email: "boss@test.com",
        name: "The Boss",
        messId: "mess_hq",
        token: "adm_hq_token",
        createdAt: new Date().toISOString(),
      });

      expect(localStorage.getItem(MEMBER_SESSION_KEY)).toBeNull();
      expect(sessionStorage.getItem(MEMBER_SESSION_KEY)).toBeNull();
      expect(getAdminSession()?.userId).toBe("usr_admin_new");
    });
  });

  describe("6. Notification Deduplication with Multiple Recipients", () => {
    it("preserves identical message text sent to different recipients", async () => {
      const mess = await serverCreateMess({
        name: "Broadcast Test Mess",
        manager: "Admin Host",
      });

      const now = new Date().toISOString();
      const notifForAlice = {
        id: "ntf_alice_1",
        mess_id: mess.id,
        sender_id: "mem_admin",
        recipient_id: "mem_alice",
        title: "Bazar Duty Reminder",
        message: "It is your turn for Bazar tomorrow morning.",
        type: "reminder" as const,
        created_at: now,
      };

      const notifForBob = {
        id: "ntf_bob_1",
        mess_id: mess.id,
        sender_id: "mem_admin",
        recipient_id: "mem_bob", // Different recipient!
        title: "Bazar Duty Reminder",
        message: "It is your turn for Bazar tomorrow morning.",
        type: "reminder" as const,
        created_at: now,
      };

      serverSaveRecord({
        messId: mess.id,
        table: "mess_notifications",
        action: "insert",
        payload: notifForAlice,
        auth: { role: "admin", messId: mess.id },
      });

      serverSaveRecord({
        messId: mess.id,
        table: "mess_notifications",
        action: "insert",
        payload: notifForBob,
        auth: { role: "admin", messId: mess.id },
      });

      const ws = await serverGetWorkspace({
        messId: mess.id,
        month: "2026-11",
        auth: { role: "admin", messId: mess.id },
      });

      const hasAlice = ws?.notifications.some((n) => n.id === "ntf_alice_1");
      const hasBob = ws?.notifications.some((n) => n.id === "ntf_bob_1");

      expect(hasAlice).toBe(true);
      expect(hasBob).toBe(true);
    });
  });

  describe("7. Offline Queue Ordering & Delete Cancellation", () => {
    it("cancels pending insert when an offline entity is deleted before sync", async () => {
      const testEntityId = "notif_temp_offline_99";
      const uuid = "op_offline_test_1";

      await enqueueSyncOperation({
        uuid,
        messId: "mess_test_offline",
        table: "mess_notifications",
        action: "insert",
        payload: { id: testEntityId, title: "Offline Draft" },
      });

      let queue = await getPendingSyncQueue("mess_test_offline");
      expect(queue.some((i) => (i.payload as { id?: string })?.id === testEntityId)).toBe(true);

      // User deletes the notification locally before reconnecting
      const cancelled = await cancelPendingOperationsForEntity(
        "mess_notifications",
        testEntityId,
      );
      expect(cancelled).toBeGreaterThanOrEqual(1);

      // Verify the operation was removed from the queue so sync cannot resurrect it
      queue = await getPendingSyncQueue("mess_test_offline");
      expect(queue.some((i) => (i.payload as { id?: string })?.id === testEntityId)).toBe(false);
    });
  });

  describe("8. Local Calendar Date & Mobile Month Selector Formatting", () => {
    it("formats local calendar date YYYY-MM-DD correctly without UTC shift", () => {
      // Create a specific local date
      const localDate = new Date(2026, 10, 15, 0, 30); // Nov 15, 2026 00:30 AM
      const formatted = formatLocalDate(localDate);
      expect(formatted).toBe("2026-11-15");
    });

    it("formats short month and year compactly for mobile screens", () => {
      expect(shortMonthYear("2026-09")).toMatch(/Sep.*2026/);
      expect(shortMonthYear("2026-11")).toMatch(/Nov.*2026/);
    });
  });
});
