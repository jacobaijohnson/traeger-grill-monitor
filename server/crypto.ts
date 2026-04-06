/**
 * AES-256-GCM encryption for Traeger tokens at rest.
 * Uses JWT_SECRET (or a dedicated ENCRYPTION_KEY env) as the key source.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = "traeger-token-encryption-v1"; // static salt — key is already high-entropy

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("No encryption key available (set ENCRYPTION_KEY or JWT_SECRET)");
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a plaintext string → base64 encoded "iv:ciphertext:tag"
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack as base64: iv + encrypted + tag
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a base64 encoded token back to plaintext.
 * Returns null if decryption fails (e.g., wrong key or corrupted data).
 */
export function decryptToken(encoded: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(encoded, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Check if a string looks like it's already encrypted (base64 with sufficient length).
 * Plaintext JWT tokens start with "eyJ" and are not valid base64 blocks of the right structure.
 */
export function isEncrypted(value: string): boolean {
  // Encrypted tokens are base64 and at least IV_LEN + TAG_LEN bytes when decoded
  if (value.startsWith("eyJ")) return false; // JWT plaintext
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length >= IV_LEN + TAG_LEN + 1 && value === buf.toString("base64");
  } catch {
    return false;
  }
}
