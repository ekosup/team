const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = "";
  for (const b of bytes) out += KEY_ALPHABET[b % KEY_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}`;
}

export async function hashAccessKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** ~40 bits of randomness in the suffix: the slug is the only key gating ticket intake, so it must resist guessing/enumeration. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let suffix = "";
  for (const b of bytes) suffix += KEY_ALPHABET[b % KEY_ALPHABET.length].toLowerCase();
  return `${base || "board"}-${suffix}`;
}
