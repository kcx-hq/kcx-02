const KEY_LABELS: Record<string, string> = {
  internet_transfer_cost: "Internet transfer cost",
  inter_az_transfer_cost: "Inter-AZ transfer cost",
  inter_region_transfer_cost: "Inter-region transfer cost",
  nat_gateway_cost: "NAT Gateway cost",
  elastic_ip_cost: "Elastic IP cost",
  usage_gb: "Usage",
  internet_usage_gb: "Internet transfer usage",
  inter_az_usage_gb: "Inter-AZ transfer usage",
  inter_region_usage_gb: "Inter-region transfer usage",
  percent_of_network_cost: "Share of network cost",
  avg_cpu: "Average CPU",
  max_cpu: "Maximum CPU",
  network_usage_gb: "Network usage",
  total_cost: "Total cost",
  compute_cost: "Compute cost",
  volume_cost: "Volume cost",
  network_cost: "Network cost",
};

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const toLabel = (key: string): string => KEY_LABELS[key] ?? `${key.replaceAll("_", " ").replace(/^\w/, (m) => m.toUpperCase())}`;
const toNum = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[%$,]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export type EvidenceItem = { label: string; value: string };

const formatValue = (key: string, value: unknown): string => {
  if (value === null || typeof value === "undefined") return "—";
  const numeric = toNum(value);
  if (numeric === null) return String(value).trim() || "—";
  const lowered = key.toLowerCase();
  if (lowered.endsWith("_cost")) return CURRENCY.format(numeric);
  if (lowered.includes("usage_gb") || lowered.endsWith("_gb")) return `${NUM.format(numeric)} GB`;
  if (lowered.includes("percent") || lowered.endsWith("_pct") || lowered.includes("cpu")) return `${NUM.format(numeric)}%`;
  return NUM.format(numeric);
};

const parseFromObject = (obj: Record<string, unknown>): EvidenceItem[] =>
  Object.entries(obj).map(([key, value]) => ({ label: toLabel(key), value: formatValue(key, value) }));

export const formatRecommendationEvidence = (raw: string | null | undefined): EvidenceItem[] => {
  const text = (raw ?? "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parseFromObject(parsed as Record<string, unknown>);
  } catch {}

  const kvParts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const kvItems = kvParts
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx < 0) return null;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      return key ? { key, value } : null;
    })
    .filter((item): item is { key: string; value: string } => item !== null);

  if (kvItems.length > 0) {
    return kvItems.map((item) => ({ label: toLabel(item.key), value: formatValue(item.key, item.value) }));
  }

  return [{ label: "Evidence", value: text }];
};

