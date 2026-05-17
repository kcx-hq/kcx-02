import { createHash } from "node:crypto";

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function normalizeForCanonical(value: unknown): JsonLike {
  if (value === null || value === undefined) return null;

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
    return value;
  }

  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;

  if (value instanceof Map) {
    const mappedObject: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      mappedObject[String(k)] = v;
    }
    return normalizeForCanonical(mappedObject);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCanonical(entry));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const normalized: Record<string, JsonLike> = {};
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      normalized[key] = normalizeForCanonical(obj[key]);
    }
    return normalized;
  }

  return String(value);
}

function buildCanonicalRawRowString(rawRow: Record<string, unknown>): string {
  return JSON.stringify(normalizeForCanonical(rawRow));
}

function buildSourceRowHash(rawRow: Record<string, unknown> | null | undefined): string | null {
  if (!rawRow || typeof rawRow !== "object") return null;
  const canonical = buildCanonicalRawRowString(rawRow);
  return createHash("sha256").update(canonical).digest("hex");
}

export { buildCanonicalRawRowString, buildSourceRowHash };

