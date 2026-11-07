import { describe, it, expect } from "vitest";
import {
  encodeInviteToken,
  decodeInviteToken,
  createMessInviteLink,
  parseInviteFromUrl,
} from "@/lib/invite";

describe("Mess Invitation Link and Token System", () => {
  it("encodes and decodes invite payload with UTF-8 support", () => {
    const payload = {
      id: "mess_test_987",
      name: "শাপলা মেস (Shapla Mess)",
      manager: "করিম রহিম",
      code: "582910",
      currency: "BDT (৳)",
      timestamp: 1741362849000,
    };

    const token = encodeInviteToken(payload);
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(20);

    const decoded = decodeInviteToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe("mess_test_987");
    expect(decoded?.name).toBe("শাপলা মেস (Shapla Mess)");
    expect(decoded?.manager).toBe("করিম রহিম");
    expect(decoded?.code).toBe("582910");
  });

  it("generates a complete valid invitation URL", () => {
    const link = createMessInviteLink({
      id: "mess_central_1",
      name: "Bashundhara Flat 4B",
      manager: "Tanvir Hasan",
      code: "839201",
      currency: "BDT (৳)",
    });

    expect(link).toContain("/join?");
    expect(link).toContain("join=1");
    expect(link).toContain("code=839201");
    expect(link).toContain("id=mess_central_1");
  });

  it("parses invite parameters from query string with fallback to plain query params", () => {
    // 1. From token query
    const token = encodeInviteToken({
      id: "mess_abc_1",
      name: "Sunrise Mess",
      manager: "Karim",
      code: "112233",
    });
    const parsed1 = parseInviteFromUrl(`?join=1&t=${token}`);
    expect(parsed1).not.toBeNull();
    expect(parsed1?.name).toBe("Sunrise Mess");
    expect(parsed1?.code).toBe("112233");

    // 2. From plain query params (if token stripped by SMS or messaging app)
    const parsed2 = parseInviteFromUrl(
      "?join=1&id=mess_xyz&name=Green+House&mgr=Rafiq&code=998877",
    );
    expect(parsed2).not.toBeNull();
    expect(parsed2?.name).toBe("Green House");
    expect(parsed2?.manager).toBe("Rafiq");
    expect(parsed2?.code).toBe("998877");
  });
});
