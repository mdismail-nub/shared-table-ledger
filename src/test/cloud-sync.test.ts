import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  publishMessToCloud,
  fetchMessFromCloudByCode,
  fetchMessFromCloudById,
} from "../lib/cloud-sync";
import type { MessRecord } from "../lib/mess-store";

describe("Cloud Sync Security & Decommissioning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("never makes external network calls to ntfy.sh or public endpoints", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const sampleMess: MessRecord = {
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

    const published = await publishMessToCloud(sampleMess);
    expect(published).toBe(true);

    const recordByCode = await fetchMessFromCloudByCode("888777");
    expect(recordByCode).toBeNull();

    const recordById = await fetchMessFromCloudById("mess_test_unicode_1");
    expect(recordById).toBeNull();

    // Verify fetch was never invoked with ntfy.sh or any external endpoint
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("safely handles non-ASCII and Unicode characters in mess names without ByteString errors", async () => {
    const unicodeMess: MessRecord = {
      mess: {
        id: "mess_test_unicode_2",
        owner_id: "usr_unicode_admin_2",
        name: "শাপলা ছাত্রাবাস 🏠",
        address: "ধানমন্ডি, ঢাকা",
        manager: "আহমেদ",
        start_day: 1,
        currency: "BDT (৳)",
        invite_code: "123456",
        show_invite_to_members: true,
        meal_categories: ["ভাত", "সবজি", "মাছ মাংস"],
        household_categories: ["বিদ্যুৎ", "ওয়াইফাই"],
      } as unknown as MessRecord["mess"],
      members: [],
      meals: [],
      expenses: [],
      payments: [],
      notifications: [],
    };

    const published = await publishMessToCloud(unicodeMess);
    expect(published).toBe(true);
  });
});
