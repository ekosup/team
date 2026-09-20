import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateAccessKey, hashAccessKey, slugify } from "../src/lib/crypto";

describe("generateAccessKey", () => {
  it("produces a dash-separated key with no ambiguous chars", () => {
    const key = generateAccessKey();
    expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(key).not.toMatch(/[01IO]/);
  });

  it("is different every call", () => {
    expect(generateAccessKey()).not.toBe(generateAccessKey());
  });
});

describe("hashAccessKey", () => {
  it("is deterministic and case/whitespace insensitive", async () => {
    const a = await hashAccessKey("abcd-1234");
    const b = await hashAccessKey(" ABCD-1234 ");
    expect(a).toBe(b);
  });

  it("differs for different keys", async () => {
    const a = await hashAccessKey("key-one");
    const b = await hashAccessKey("key-two");
    expect(a).not.toBe(b);
  });
});

describe("slugify", () => {
  it("lowercases, dashes, and appends a random suffix", () => {
    const slug = slugify("Team Rocket!!");
    expect(slug).toMatch(/^team-rocket-[a-z0-9]{8}$/);
  });

  it("falls back to 'board' when input has no alnum chars", () => {
    expect(slugify("!!!")).toMatch(/^board-[a-z0-9]{8}$/);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips plaintext", async () => {
    const cipher = await encryptSecret("db password: hunter2", "test-key");
    expect(cipher).not.toContain("hunter2");
    expect(await decryptSecret(cipher, "test-key")).toBe("db password: hunter2");
  });

  it("fails to decrypt with the wrong key", async () => {
    const cipher = await encryptSecret("top secret", "key-a");
    await expect(decryptSecret(cipher, "key-b")).rejects.toThrow();
  });

  it("produces different ciphertext for the same input (random IV)", async () => {
    const a = await encryptSecret("same value", "test-key");
    const b = await encryptSecret("same value", "test-key");
    expect(a).not.toBe(b);
  });
});
