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

async function docsEncKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Encrypts secret doc content for storage; DOCS_ENC_KEY lives only in worker env, never in D1. */
export async function encryptSecret(plain: string, secret: string): Promise<string> {
  const key = await docsEncKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  const out = new Uint8Array(iv.length + data.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(data), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptSecret(ciphertext: string, secret: string): Promise<string> {
  const key = await docsEncKey(secret);
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
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
