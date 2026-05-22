type ReservationNormalized = { groupKey: string; groupLabel: string };

const toKey = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

export const normalizeReservationType = (value: string | null | undefined): ReservationNormalized => {
  const key = toKey(value);
  if (key === "ondemand" || key === "on_demand") return { groupKey: "on_demand", groupLabel: "On-Demand" };
  if (key === "reserved" || key === "reserved_instance" || key === "ri") return { groupKey: "reserved", groupLabel: "Reserved" };
  if (key === "savingsplan" || key === "savings_plan" || key === "sp") return { groupKey: "savings_plan", groupLabel: "Savings Plan" };
  if (key === "spot") return { groupKey: "spot", groupLabel: "Spot" };
  return { groupKey: "unknown", groupLabel: "Unknown" };
};

export const normalizeRegion = (value: string | null | undefined): { groupKey: string; groupLabel: string } => {
  const v = String(value ?? "").trim();
  if (!v) return { groupKey: "unknown", groupLabel: "Unknown" };
  return { groupKey: v, groupLabel: v };
};

export const normalizeCostType = (value: string | null | undefined): { groupKey: string; groupLabel: string } => {
  const key = toKey(value);
  if (key === "compute") return { groupKey: "compute", groupLabel: "Compute" };
  if (key === "ebs" || key === "volume") return { groupKey: "volume", groupLabel: "Volume" };
  if (key === "snapshot") return { groupKey: "snapshot", groupLabel: "Snapshot" };
  if (key === "data_transfer") return { groupKey: "data_transfer", groupLabel: "Data Transfer" };
  if (key === "eip" || key === "elastic_ip") return { groupKey: "elastic_ip", groupLabel: "Elastic IP" };
  return { groupKey: "other", groupLabel: "Other" };
};

export const normalizeUnknown = (value: string | null | undefined): { groupKey: string; groupLabel: string } => {
  const v = String(value ?? "").trim();
  if (!v) return { groupKey: "unknown", groupLabel: "Unknown" };
  return { groupKey: v, groupLabel: v };
};

export const toTagValue = (tags: Record<string, unknown> | null, key: string | null): string => {
  if (!tags || !key) return "Unknown";
  const direct = tags[key];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const fallback = Object.entries(tags).find(([k]) => k.toLowerCase() === key.toLowerCase());
  if (!fallback || typeof fallback[1] !== "string" || !fallback[1].trim()) return "Unknown";
  return fallback[1].trim();
};
