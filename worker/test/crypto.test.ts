import { describe, expect, it } from "vitest";
import { generateAccessKey, hashAccessKey, slugify } from "../src/lib/crypto";

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
