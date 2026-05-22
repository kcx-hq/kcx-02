const normalized = (value: unknown): string => String(value ?? "").trim();

export const normalizeUnknown = (value: unknown): { groupKey: string; groupLabel: string } => {
  const raw = normalized(value);
  if (!raw) return { groupKey: "unknown", groupLabel: "Unknown" };
  return { groupKey: raw.toLowerCase(), groupLabel: raw };
};

export const normalizeTagValue = (tagsJson: Record<string, unknown> | null, tagKey: string | null): { groupKey: string; groupLabel: string } => {
  if (!tagKey) return { groupKey: "untagged", groupLabel: "Untagged" };
  const key = tagKey.trim();
  const value = String((tagsJson ?? {})[key] ?? (tagsJson ?? {})[key.toLowerCase()] ?? "").trim();
  if (!value) return { groupKey: "untagged", groupLabel: "Untagged" };
  return { groupKey: value.toLowerCase(), groupLabel: value };
};

