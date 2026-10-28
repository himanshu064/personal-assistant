import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronAuthorized } from "./cron-auth";
import { decrypt, encrypt } from "./crypto";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encrypt / decrypt (AES-256-GCM)", () => {
  const KEY = "0123456789abcdef0123456789abcdef";

  it("round trips a key", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(decrypt(encrypt("sk-ant-secret-ÿ-🔑"))).toBe("sk-ant-secret-ÿ-🔑");
  });

  it("uses a new IV every time", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a changed ciphertext", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const buf = Buffer.from(encrypt("secret"), "base64");
    buf[buf.length - 1] ^= 1;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("rejects the wrong key", () => {
    vi.stubEnv("ENCRYPTION_KEY", KEY);
    const sealed = encrypt("secret");
    vi.stubEnv("ENCRYPTION_KEY", "ffffffffffffffffffffffffffffffff");
    expect(() => decrypt(sealed)).toThrow();
  });

  it("needs a 32 character key", () => {
    vi.stubEnv("ENCRYPTION_KEY", "short");
    expect(() => encrypt("secret")).toThrow("ENCRYPTION_KEY must be exactly 32 characters");
  });
});

describe("isCronAuthorized", () => {
  const req = (headers: Record<string, string>) => new NextRequest("https://example.com/api/cron/reminders", { headers });

  it("accepts the secret in either header", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(req({ "x-cron-secret": "s3cret" }))).toBe(true);
    expect(isCronAuthorized(req({ authorization: "Bearer s3cret" }))).toBe(true);
  });

  it("rejects a wrong, missing or longer secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(req({ "x-cron-secret": "nope00" }))).toBe(false);
    expect(isCronAuthorized(req({ "x-cron-secret": "s3cret-and-more" }))).toBe(false);
    expect(isCronAuthorized(req({}))).toBe(false);
  });

  it("rejects everything when no secret is set", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(req({ "x-cron-secret": "" }))).toBe(false);
  });
});
