import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const parts = passwordHash.split("$");
  if (parts.length !== 3) return false;
  const [algo, saltB64, keyB64] = parts;
  if (algo !== "scrypt") return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const derivedKey = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, derivedKey);
}

export function generateTemporaryPassword(length: number = 14): string {
  // base64url-ish, then add a couple of symbols for complexity
  const core = randomBytes(Math.ceil(length)).toString("base64url").slice(0, length);
  return `${core}!A9`;
}

