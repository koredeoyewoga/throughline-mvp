import { describe, it, expect } from "vitest";
import { signSession, verifySession, type SessionUser } from "@/lib/auth/session";

const user: SessionUser = {
  sub: "u-oversight",
  name: "Alan Reeve",
  role: "oversight",
  placeId: "place-meadowford",
  orgId: "org-mch",
};

describe("session tokens", () => {
  it("round-trips a valid session", async () => {
    const token = await signSession(user);
    expect(await verifySession(token)).toEqual(user);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(user);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...user, role: "coordinator", exp: 9e12 })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
    expect(await verifySession(`${body}.${sig.slice(0, -2)}xy`)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession(user, -10);
    expect(await verifySession(token)).toBeNull();
  });

  it("rejects junk and empty input", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("not-a-token")).toBeNull();
    expect(await verifySession("a.b.c")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(user);
    process.env.THROUGHLINE_SESSION_SECRET = "a-different-secret";
    try {
      expect(await verifySession(token)).toBeNull();
    } finally {
      delete process.env.THROUGHLINE_SESSION_SECRET;
    }
  });
});
