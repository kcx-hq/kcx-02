import { createHmac, timingSafeEqual } from "node:crypto";

type JwtPrimitive = string | number | boolean | null;
type JwtPayloadValue = JwtPrimitive | JwtPrimitive[] | Record<string, unknown>;

export type JwtPayload = Record<string, JwtPayloadValue>;

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

type SignJwtInput = {
  secret: string;
  payload: JwtPayload;
  expiresInSeconds: number;
};

const base64UrlEncode = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  return Buffer.from(padded, "base64");
};

const sign = (encodedHeader: string, encodedPayload: string, secret: string): string => {
  return base64UrlEncode(createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest());
};

const parseJson = <T>(value: Buffer): T | null => {
  try {
    return JSON.parse(value.toString("utf8")) as T;
  } catch {
    return null;
  }
};

export const signJwt = ({ secret, payload, expiresInSeconds }: SignJwtInput): string => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedHeader, encodedPayload, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const expectedSignature = sign(encodedHeader, encodedPayload, secret);
  const receivedSignature = encodedSignature;

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

  const header = parseJson<JwtHeader>(base64UrlDecode(encodedHeader));
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;

  const payload = parseJson<JwtPayload>(base64UrlDecode(encodedPayload));
  if (!payload) return null;

  const exp = payload.exp;
  if (typeof exp !== "number") return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp <= nowSeconds) return null;

  return payload;
};
