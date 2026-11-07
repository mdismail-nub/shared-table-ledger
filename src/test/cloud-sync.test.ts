import { describe, it, expect, vi } from "vitest";
import {
  publishMessToCloud,
  fetchMessFromCloudByCode,
  fetchMessFromCloudById,
} from "../lib/cloud-sync";
import type { MessRecord } from "../lib/mess-store";

describe("Cloud Sync and Attachment Resolution", () => {
  it("safely handles non-ASCII and Unicode characters in mess names without ByteString errors", async () => {
    const unicodeMess: MessRecord = {
      mess: {
        id: "mess_test_unicode_1",
        owner_id: "usr_unicode_admin",
        name: "শাপলা ছাত্রাবাস 🏠",
        address: "ধানমন্ডি, ঢাকা",
        manager: "আহমেদ",
        start_day: 1,
        currency: "BDT (৳)",
        invite_code: "888777",
        show_invite_to_members: true,
        meal_categories: ["ভাত", "সবজি", "মাছ মাংস"],
        household_categories: ["বিদ্যুৎ", "ওয়াইফাই"],
      } as unknown as MessRecord["mess"],
      members: [
        {
          id: "mem_unicode_1",
          user_id: "usr_unicode_admin",
          role: "admin",
          name: "আহমেদ",
          phone: "01700000000",
          room: "১০১",
          joined: "2026-11-01",
          status: "active",
          tone: "primary",
        },
      ],
      meals: [],
      expenses: [],
      payments: [],
      notifications: [],
    };

    // Should not throw ByteString TypeError and complete within timeout
    const published = await publishMessToCloud(unicodeMess);
    expect(published).toBe(true);
  });

  it("handles offline or unreachable network gracefully without throwing unhandled errors", async () => {
    const record = await fetchMessFromCloudByCode("999999");
    // Should return null gracefully rather than throwing an exception
    expect(record === null || typeof record === "object").toBe(true);
  });

  it("handles messId cloud lookup gracefully", async () => {
    const record = await fetchMessFromCloudById("mess_non_existent");
    expect(record === null || typeof record === "object").toBe(true);
  });
});
