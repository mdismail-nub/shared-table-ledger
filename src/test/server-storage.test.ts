import { describe, expect, it } from "vitest";
import {
  serverCreateMess,
  serverLookupMessByCode,
  serverGetWorkspace,
  serverSaveRecord,
} from "@/lib/server-storage.server";

describe("Server storage and 6-digit code member joining", () => {
  it("creates a mess with a valid 6-digit invite code and finds it", async () => {
    const created = await serverCreateMess({
      name: "Sunrise Villa",
      manager: "Kabir Hossain",
      address: "Mirpur 10, Dhaka",
    });

    expect(created.id).toBeDefined();
    expect(created.invite_code).toMatch(/^\d{6}$/);

    // Member joins with the 6-digit code from any browser or device
    const lookup = await serverLookupMessByCode(created.invite_code);
    expect(lookup).not.toBeNull();
    expect(lookup?.name).toBe("Sunrise Villa");
    expect(lookup?.members.length).toBeGreaterThanOrEqual(1);
    expect(lookup?.members[0]?.name).toBe("Kabir Hossain");
  });

  it("loads workspace data by invite code for members", async () => {
    const created = await serverCreateMess({
      name: "Green Valley Mess",
      manager: "Rafiq",
    });

    const month = new Date().toISOString().slice(0, 7);
    const workspace = await serverGetWorkspace({
      code: created.invite_code,
      month,
    });

    expect(workspace).not.toBeNull();
    expect(workspace?.mess.name).toBe("Green Valley Mess");
    expect(workspace?.summary).toBeDefined();
    expect(workspace?.notifications.length).toBeGreaterThanOrEqual(1);
  });

  it("allows admin to add members and send custom notifications", async () => {
    const created = await serverCreateMess({
      name: "Bachelor Haven",
      manager: "Admin Hasan",
    });

    const newMember = {
      id: "mem_shakib_99",
      user_id: null,
      role: "member" as const,
      name: "Shakib Al Hasan",
      phone: "01700-112233",
      room: "201",
      joined: new Date().toISOString().slice(0, 10),
      status: "active" as const,
      tone: "mint" as const,
    };

    serverSaveRecord({
      messId: created.id,
      table: "mess_members",
      action: "insert",
      payload: newMember,
    });

    // Check member appears in lookup
    const lookup = await serverLookupMessByCode(created.invite_code);
    const found = lookup?.members.find((m) => m.id === "mem_shakib_99");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Shakib Al Hasan");

    // Admin sends a targeted notification to Shakib
    const notif = {
      id: `ntf_custom_${Date.now()}`,
      mess_id: created.id,
      sender_id: "mem_admin",
      recipient_id: "mem_shakib_99",
      title: "Utility Bill Due",
      message: "Please pay your electricity bill share by tomorrow.",
      type: "reminder",
      created_at: new Date().toISOString(),
    };

    serverSaveRecord({
      messId: created.id,
      table: "mess_notifications",
      action: "insert",
      payload: notif,
    });

    const month = new Date().toISOString().slice(0, 7);
    const workspace = await serverGetWorkspace({
      messId: created.id,
      month,
    });

    expect(workspace?.notifications.some((n) => n.id === notif.id)).toBe(true);
  });
});
