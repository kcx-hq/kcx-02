const SUPPORTED_BUSINESS_TAG_KEYS = Object.freeze([
  "Environment",
  "Application",
  "Team",
  "CostCenter",
  "Project",
  "Customer",
] as const);

type SupportedBusinessTagKey = (typeof SUPPORTED_BUSINESS_TAG_KEYS)[number];

const NORMALIZED_KEY_TO_CANONICAL: Record<string, SupportedBusinessTagKey> = Object.freeze({
  environment: "Environment",
  application: "Application",
  team: "Team",
  costcenter: "CostCenter",
  project: "Project",
  customer: "Customer",
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const normalizeTagKeyToken = (key: string): string =>
  key
    .trim()
    .replace(/^user:/i, "")
    .replace(/^aws:/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeTagValueToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const coerceTagsToObject = (value: unknown): Record<string, unknown> | null => {
  if (isBlank(value)) return null;

  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries()).map(([key, mapValue]) => [String(key), mapValue]));
  }

  if (Array.isArray(value)) {
    const tupleLike = value.every((entry) => Array.isArray(entry) && entry.length === 2);
    if (tupleLike) {
      return Object.fromEntries(value.map(([key, mapValue]) => [String(key), mapValue]));
    }

    const keyValueStructLike = value.every(
      (entry) => entry && typeof entry === "object" && "key" in entry && "value" in entry,
    );
    if (keyValueStructLike) {
      return Object.fromEntries(
        value.map((entry) => [String((entry as { key: unknown }).key), (entry as { value: unknown }).value]),
      );
    }

    return null;
  }

  if (isRecord(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeBusinessTagKey = (key: string): string => {
  const normalized = normalizeTagKeyToken(key);
  return NORMALIZED_KEY_TO_CANONICAL[normalized] ?? key.trim();
};

const normalizeAwsTagsJson = (value: unknown): unknown => {
  const asObject = coerceTagsToObject(value);
  if (!asObject) return value;

  const normalizedEntries = Object.entries(asObject).map(([key, tagValue]) => [
    normalizeBusinessTagKey(key),
    tagValue,
  ]);

  return Object.fromEntries(normalizedEntries);
};

const extractSupportedBusinessTags = (value: unknown): Partial<Record<SupportedBusinessTagKey, unknown>> => {
  const asObject = coerceTagsToObject(value);
  if (!asObject) return {};

  const extracted: Partial<Record<SupportedBusinessTagKey, unknown>> = {};

  for (const [rawKey, rawValue] of Object.entries(asObject)) {
    const normalizedKey = normalizeBusinessTagKey(rawKey);
    if (SUPPORTED_BUSINESS_TAG_KEYS.includes(normalizedKey as SupportedBusinessTagKey)) {
      extracted[normalizedKey as SupportedBusinessTagKey] = rawValue;
    }
  }

  return extracted;
};

type SelectedBusinessTag = {
  tagKey: SupportedBusinessTagKey;
  tagValue: string;
  normalizedKey: string;
  normalizedValue: string;
};

const selectPrimarySupportedBusinessTag = (value: unknown): SelectedBusinessTag | null => {
  const supported = extractSupportedBusinessTags(value);

  for (const key of SUPPORTED_BUSINESS_TAG_KEYS) {
    const rawValue = supported[key];
    if (isBlank(rawValue)) continue;

    const tagValue = String(rawValue).trim();
    if (!tagValue) continue;

    return {
      tagKey: key,
      tagValue,
      normalizedKey: normalizeTagKeyToken(key),
      normalizedValue: normalizeTagValueToken(tagValue),
    };
  }

  return null;
};

export {
  SUPPORTED_BUSINESS_TAG_KEYS,
  normalizeBusinessTagKey,
  normalizeAwsTagsJson,
  extractSupportedBusinessTags,
  selectPrimarySupportedBusinessTag,
};
