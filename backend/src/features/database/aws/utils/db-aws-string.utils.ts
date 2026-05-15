export const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeLowerNonEmptyString = (value: unknown): string | null => {
  const normalized = normalizeNonEmptyString(value);
  return normalized ? normalized.toLowerCase() : null;
};
