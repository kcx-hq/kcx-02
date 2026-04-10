import { createHash } from "node:crypto";

type DailyTotalCostSpikeFingerprintInput = {
  tenantId: string | null;
  billingSourceId: string;
  usageDate: string;
  anomalyType: string;
  sourceGranularity: string;
  sourceTable: string;
  detectorScope: string;
};

const normalize = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();

export function buildDailyTotalCostSpikeFingerprint(input: DailyTotalCostSpikeFingerprintInput): string {
  const stableIdentity = [
    "daily_total_cost_spike",
    `tenant:${normalize(input.tenantId) || "none"}`,
    `billing_source:${normalize(input.billingSourceId)}`,
    `usage_date:${normalize(input.usageDate)}`,
    `anomaly_type:${normalize(input.anomalyType)}`,
    `granularity:${normalize(input.sourceGranularity)}`,
    `source_table:${normalize(input.sourceTable)}`,
    `scope:${normalize(input.detectorScope)}`,
  ].join("|");

  return createHash("sha256").update(stableIdentity).digest("hex");
}
