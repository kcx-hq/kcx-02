// @ts-nocheck
import { QueryTypes } from "sequelize";
import { activateDemoDbEnv } from "./demo-db-utils.js";
import { Ec2RecommendationsService } from "../src/features/ec2/optimization/ec2-recommendations.service.js";
import { BillingSource, Tenant, sequelize } from "../src/models/index.js";

type CheckRow = {
  resource: string;
  check: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
};

const DEMO_IDS = {
  instances: [
    "i-demo-idle-001",
    "i-demo-under-001",
    "i-demo-over-001",
    "i-demo-healthy-001",
    "i-demo-uncovered-001",
    "i-demo-storage-heavy-001",
    "i-demo-stopped-001",
  ],
  volume: "vol-demo-unattached-001",
  snapshot: "snap-demo-old-001",
};

const EXPECTED = {
  "i-demo-idle-001": { cpu: 2, state: "running", pricing: "reserved", recType: "idle_instance", recCategory: "compute" },
  "i-demo-under-001": { cpu: 12, state: "running", pricing: "savings_plan", recType: "underutilized_instance", recCategory: "compute" },
  "i-demo-over-001": { cpu: 85, state: "running", pricing: "reserved", recType: "overutilized_instance", recCategory: "compute" },
  "i-demo-healthy-001": { cpu: 45, state: "running", pricing: "reserved", recType: null, recCategory: null },
  "i-demo-uncovered-001": { cpu: 38, state: "running", pricing: "on_demand", recType: "uncovered_on_demand", recCategory: "pricing" },
  "i-demo-storage-heavy-001": { cpu: 24, state: "running", pricing: "on_demand", recType: "uncovered_on_demand", recCategory: "pricing" },
  "i-demo-stopped-001": { cpu: 0.2, state: "stopped", pricing: "on_demand", recType: null, recCategory: null },
  "vol-demo-unattached-001": { recType: "unattached_volume", recCategory: "storage" },
  "snap-demo-old-001": { recType: "old_snapshot", recCategory: "storage" },
} as const;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "null";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function addCheck(rows: CheckRow[], resource: string, check: string, expected: unknown, actual: unknown): void {
  const expectedText = formatValue(expected);
  const actualText = formatValue(actual);
  rows.push({
    resource,
    check,
    expected: expectedText,
    actual: actualText,
    status: expectedText === actualText ? "PASS" : "FAIL",
  });
}

function normalizeRecType(type: string | null | undefined): string | null {
  const t = String(type ?? "").trim().toLowerCase();
  if (!t) return null;
  return t;
}

function classifyByThreshold(cpu: number, networkMb: number): string | null {
  if (cpu < 5 && networkMb < 100) return "idle_instance";
  if (cpu >= 5 && cpu < 20 && networkMb < 1024) return "underutilized_instance";
  if (cpu > 75) return "overutilized_instance";
  return null;
}

async function main(): Promise<void> {
  activateDemoDbEnv();

  const checks: CheckRow[] = [];

  const tenant = await Tenant.findOne({ where: { slug: "demo-organization" } });
  if (!tenant) throw new Error("Demo tenant not found (slug=demo-organization)");

  const source = await BillingSource.findOne({
    where: { tenantId: tenant.id, sourceName: "Demo CUR2 Source" },
  });
  if (!source) throw new Error("Demo billing source not found (Demo CUR2 Source)");

  const end = new Date();
  const start = addDays(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())), -29);
  const dateFrom = toDateOnly(start);
  const dateTo = toDateOnly(end);

  const service = new Ec2RecommendationsService();
  await service.refreshRecommendations({
    tenantId: String(tenant.id),
    billingSourceId: Number(source.id),
    cloudConnectionId: source.cloudConnectionId ? String(source.cloudConnectionId) : null,
    dateFrom,
    dateTo,
  });

  const overviewRows = await sequelize.query<{
    total_cost: number;
    compute_cost: number;
    ebs_cost: number;
    avg_cpu: number;
    avg_net_mb: number;
  }>(
    `
    SELECT
      COALESCE(SUM(total_effective_cost), 0)::double precision AS total_cost,
      COALESCE(SUM(compute_cost), 0)::double precision AS compute_cost,
      COALESCE(SUM(ebs_cost), 0)::double precision AS ebs_cost,
      COALESCE(AVG(cpu_avg), 0)::double precision AS avg_cpu,
      COALESCE(AVG((COALESCE(network_in_bytes,0) + COALESCE(network_out_bytes,0)) / 1024.0 / 1024.0), 0)::double precision AS avg_net_mb
    FROM fact_ec2_instance_daily
    WHERE tenant_id = :tenantId
      AND billing_source_id = :billingSourceId
      AND usage_date >= :dateFrom::date
      AND usage_date <= :dateTo::date
    `,
    {
      replacements: {
        tenantId: String(tenant.id),
        billingSourceId: Number(source.id),
        dateFrom,
        dateTo,
      },
      type: QueryTypes.SELECT,
    },
  );
  const ov = overviewRows[0];
  addCheck(checks, "Explorer", "Total cost > 0", true, ov.total_cost > 0);
  addCheck(checks, "Explorer", "Compute cost > 0", true, ov.compute_cost > 0);
  addCheck(checks, "Explorer", "EBS cost > 0", true, ov.ebs_cost > 0);

  const instanceRows = await sequelize.query<{
    instance_id: string;
    state: string | null;
    reservation_type: string | null;
    avg_cpu: number | null;
    avg_net_mb: number | null;
    total_cost: number | null;
  }>(
    `
    SELECT
      instance_id,
      MAX(state)::text AS state,
      MAX(reservation_type)::text AS reservation_type,
      AVG(cpu_avg)::double precision AS avg_cpu,
      AVG((COALESCE(network_in_bytes,0) + COALESCE(network_out_bytes,0)) / 1024.0 / 1024.0)::double precision AS avg_net_mb,
      SUM(total_effective_cost)::double precision AS total_cost
    FROM fact_ec2_instance_daily
    WHERE tenant_id = :tenantId
      AND billing_source_id = :billingSourceId
      AND usage_date >= :dateFrom::date
      AND usage_date <= :dateTo::date
      AND instance_id IN (:instanceIds)
    GROUP BY instance_id
    `,
    {
      replacements: {
        tenantId: String(tenant.id),
        billingSourceId: Number(source.id),
        dateFrom,
        dateTo,
        instanceIds: DEMO_IDS.instances,
      },
      type: QueryTypes.SELECT,
    },
  );

  const recData = await service.getRecommendations({
    tenantId: String(tenant.id),
    billingSourceId: Number(source.id),
    cloudConnectionId: source.cloudConnectionId ? String(source.cloudConnectionId) : null,
    dateFrom,
    dateTo,
    category: null,
    type: null,
    status: null,
    account: null,
    region: null,
    team: null,
    product: null,
    environment: null,
    tags: [],
  });

  const recByResource = new Map<string, { type: string; category: "compute" | "storage" | "pricing" }>();
  for (const item of recData.recommendations.compute) recByResource.set(item.resourceId, { type: item.type, category: "compute" });
  for (const item of recData.recommendations.storage) recByResource.set(item.resourceId, { type: item.type, category: "storage" });
  for (const item of recData.recommendations.pricing) recByResource.set(item.resourceId, { type: item.type, category: "pricing" });

  for (const row of instanceRows) {
    const expected = EXPECTED[row.instance_id as keyof typeof EXPECTED] as any;
    addCheck(checks, row.instance_id, "state", expected.state, row.state ?? null);
    addCheck(checks, row.instance_id, "pricing type", expected.pricing, row.reservation_type ?? null);
    addCheck(checks, row.instance_id, "avg CPU", expected.cpu.toFixed(2), Number(row.avg_cpu ?? 0).toFixed(2));
    addCheck(checks, row.instance_id, "total cost > 0", true, Number(row.total_cost ?? 0) > 0);

    const rec = recByResource.get(row.instance_id);
    addCheck(checks, row.instance_id, "recommendation type", expected.recType, normalizeRecType(rec?.type));
    addCheck(checks, row.instance_id, "recommendation category", expected.recCategory, rec?.category ?? null);
  }

  const volumeRows = await sequelize.query<{
    volume_id: string;
    state: string | null;
    is_unattached: boolean | null;
    total_cost: number | null;
  }>(
    `
    SELECT
      volume_id,
      MAX(state)::text AS state,
      BOOL_OR(COALESCE(is_unattached, FALSE)) AS is_unattached,
      SUM(total_cost)::double precision AS total_cost
    FROM fact_ebs_volume_daily
    WHERE tenant_id = :tenantId
      AND billing_source_id = :billingSourceId
      AND usage_date >= :dateFrom::date
      AND usage_date <= :dateTo::date
      AND volume_id = :volumeId
    GROUP BY volume_id
    `,
    {
      replacements: {
        tenantId: String(tenant.id),
        billingSourceId: Number(source.id),
        dateFrom,
        dateTo,
        volumeId: DEMO_IDS.volume,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (volumeRows[0]) {
    const v = volumeRows[0];
    addCheck(checks, v.volume_id, "state", "available", v.state ?? null);
    addCheck(checks, v.volume_id, "is_unattached", true, Boolean(v.is_unattached));
    addCheck(checks, v.volume_id, "total cost > 5", true, Number(v.total_cost ?? 0) > 5);
    const rec = recByResource.get(v.volume_id);
    addCheck(checks, v.volume_id, "recommendation type", EXPECTED[DEMO_IDS.volume].recType, normalizeRecType(rec?.type));
    addCheck(checks, v.volume_id, "recommendation category", EXPECTED[DEMO_IDS.volume].recCategory, rec?.category ?? null);
  } else {
    addCheck(checks, DEMO_IDS.volume, "exists in volume facts", true, false);
  }

  const snapshotRows = await sequelize.query<{
    snapshot_id: string;
    start_time: Date | null;
  }>(
    `
    SELECT snapshot_id, start_time
    FROM ec2_snapshot_inventory_snapshots
    WHERE tenant_id = :tenantId
      AND snapshot_id = :snapshotId
      AND is_current = TRUE
    LIMIT 1
    `,
    {
      replacements: {
        tenantId: String(tenant.id),
        snapshotId: DEMO_IDS.snapshot,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (snapshotRows[0]) {
    const s = snapshotRows[0];
    const ageDays = s.start_time ? Math.floor((Date.now() - new Date(s.start_time).getTime()) / (1000 * 60 * 60 * 24)) : -1;
    addCheck(checks, s.snapshot_id, "age >= 90 days", true, ageDays >= 90);
    const rec = recByResource.get(s.snapshot_id);
    addCheck(checks, s.snapshot_id, "recommendation type", EXPECTED[DEMO_IDS.snapshot].recType, normalizeRecType(rec?.type));
    addCheck(checks, s.snapshot_id, "recommendation category", EXPECTED[DEMO_IDS.snapshot].recCategory, rec?.category ?? null);
  } else {
    addCheck(checks, DEMO_IDS.snapshot, "exists in snapshot inventory", true, false);
  }

  const boundary = [
    { cpu: 4.9, net: 99, expected: "idle_instance", label: "CPU 4.9" },
    { cpu: 5.0, net: 300, expected: "underutilized_instance", label: "CPU 5.0" },
    { cpu: 20.0, net: 300, expected: null, label: "CPU 20.0" },
    { cpu: 75.0, net: 300, expected: null, label: "CPU 75.0" },
    { cpu: 75.1, net: 300, expected: "overutilized_instance", label: "CPU 75.1" },
  ];

  for (const item of boundary) {
    const actual = classifyByThreshold(item.cpu, item.net);
    addCheck(checks, "Boundary", `${item.label} classification`, item.expected, actual);
  }

  const header = "Resource | Check | Expected | Actual | Status";
  console.info(header);
  console.info("-".repeat(header.length));
  for (const row of checks) {
    console.info(`${row.resource} | ${row.check} | ${row.expected} | ${row.actual} | ${row.status}`);
  }

  const failCount = checks.filter((x) => x.status === "FAIL").length;
  console.info(`\nSummary: total=${checks.length}, pass=${checks.length - failCount}, fail=${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("validate:ec2-demo failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
