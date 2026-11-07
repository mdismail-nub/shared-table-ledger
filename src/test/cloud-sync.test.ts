import { describe, it, expect } from "vitest";
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

    // Should not throw ByteString TypeError
    const published = await publishMessToCloud(unicodeMess);
    expect(published).toBe(true);
  });

  it("successfully fetches existing cloud mess 306611 even when stored as an attachment", async () => {
    const record = await fetchMessFromCloudByCode("306611");
    expect(record).not.toBeNull();
    expect(record?.mess.name).toBe("vertex");
    expect(record?.mess.manager).toBe("md ismail");
    expect((record?.mess as unknown as { invite_code?: string })?.invite_code).toBe("306611");
    expect(record?.members.length).toBeGreaterThan(0);
  });
});
