import { ValidationError } from "../../../errors/http-errors.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const requireString = (
  obj: Record<string, unknown>,
  key: string,
): string => {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new ValidationError("Validation failed", { field: key, issue: "required_string" });
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError("Validation failed", { field: key, issue: "required" });
  }
  return trimmed;
};

export const optionalString = (
  obj: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = obj[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError("Validation failed", { field: key, issue: "must_be_string" });
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const requireEmail = (
  obj: Record<string, unknown>,
  key: string,
): string => {
  const email = requireString(obj, key).toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!isValid) {
    throw new ValidationError("Validation failed", { field: key, issue: "invalid_email" });
  }
  return email;
};
