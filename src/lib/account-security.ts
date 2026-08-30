import { createHash, createHmac, randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";

export const LEGACY_USER_ID = "00000000-0000-4000-8000-000000000001";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validPassword = (password: string) => password.length >= 12 && password.length <= 128;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(hash || "") || password.length > 128) return false;
  return safeEqual((await scrypt(password, salt)).toString("hex"), hash);
}

export function signSession(user: { id: string; sessionVersion: number }, secret: string) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, version: user.sessionVersion, exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readSession(token: string | undefined, secret: string, legacyEmail: string) {
  if (!token || token.length > 2048 || !secret) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, createHmac("sha256", secret).update(payload).digest("base64url"))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    if (typeof data.uid === "string" && /^[a-f0-9-]{36}$/i.test(data.uid) && Number.isInteger(data.version) && data.version > 0) return { id: data.uid as string, version: data.version as number };
    // Existing signed cookies remain valid only for the original owner at version 1.
    if (legacyEmail && typeof data.email === "string" && normalizeEmail(data.email) === normalizeEmail(legacyEmail)) return { id: LEGACY_USER_ID, version: 1 };
  } catch { /* Invalid tokens never authenticate. */ }
  return null;
}
