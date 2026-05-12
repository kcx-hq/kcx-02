// @ts-nocheck
import { QueryTypes } from "sequelize";

import {
  BillingSource,
  LoadBalancer,
  LoadBalancerCostDaily,
  LoadBalancerListener,
  LoadBalancerMetricsDaily,
  LoadBalancerTargetGroup,
  sequelize,
} from "../src/models/index.js";

type CliArgs = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  ingestionRunId: string | null;
  includeRawResourceIdAlias: boolean;
};

type FactArnRow = {
  arn: string;
  billing_source_id: string | null;
  provider_id: string | null;
};

type SeedLoadBalancerProfile = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  arn: string;
  scheme: "internet-facing" | "internal";
  trafficClass: "high" | "low" | "idle";
  reliabilityClass: "stable" | "noisy";
};

type DailyMetricSeedRow = {
  requestCount: number;
  processedBytes: number;
  processedGb: number;
  activeConnectionCount: number;
  newConnectionCount: number;
  activeFlowCount: number;
  newFlowCount: number;
  healthyHostCount: number;
  unhealthyHostCount: number;
  targetResponseTimeAvg: number;
  elb5xxCount: number;
  target5xxCount: number;
  tcpTargetResetCount: number;
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  const getValue = (key: string): string | null => {
    const hit = args.find((item) => item.startsWith(`--${key}=`));
    if (!hit) return null;
    return hit.slice(key.length + 3);
  };

  const hasFlag = (key: string): boolean => args.includes(`--${key}`);

  return {
    cloudConnectionId: normalizeTrim(getValue("cloud-connection-id")),
    accountId: normalizeTrim(getValue("account-id")),
    region: normalizeTrim(getValue("region")),
    ingestionRunId: normalizeTrim(getValue("ingestion-run-id")) || null,
    includeRawResourceIdAlias: hasFlag("include-raw-resource-id-alias"),
  };
};

const printUsage = (): void => {
  console.info(`
Usage:
  npx tsx backend/scripts/seed-load-balancer-inventory-dummy-data.ts \\
    --cloud-connection-id=<uuid> \\
    --account-id=<12_digit_account_id> \\
    --region=<aws_region> \\
    [--ingestion-run-id=<run_id>]

Notes:
  - If --ingestion-run-id is provided, script extracts LB resource ids from fact CUR rows for that run.
  - Supports both full ELB ARNs and shorthand ids like app/<name>/<hash> or net/<name>/<hash>.
  - If not provided, script inserts realistic multi-region ALB/NLB inventory + daily cost + metrics.
  - Optional: --include-raw-resource-id-alias (stores raw CUR resource id as extra load_balancers.arn)
  `);
};

const classifyLbType = (arn: string): "application" | "network" =>
  arn.toLowerCase().includes(":loadbalancer/net/") ? "network" : "application";

const deriveNameFromArn = (arn: string): string => {
  const parts = arn.split("/");
  if (parts.length >= 3) return parts[2];
  return arn;
};

const deriveDnsName = (name: string, region: string): string => `${name}.${region}.elb.amazonaws.com`;

async function resolveArnsFromIngestionRun(ingestionRunId: string): Promise<FactArnRow[]> {
  return sequelize.query<FactArnRow>(
    `
SELECT DISTINCT
  dr.resource_id AS arn,
  f.billing_source_id::text AS billing_source_id,
  f.provider_id::text AS provider_id
FROM fact_cost_line_items f
JOIN dim_resource dr
  ON dr.id = f.resource_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND dr.resource_id IS NOT NULL
  AND (
    LOWER(dr.resource_id) LIKE 'arn:aws%:elasticloadbalancing:%'
    OR LOWER(dr.resource_id) LIKE 'app/%'
    OR LOWER(dr.resource_id) LIKE 'net/%'
  )
ORDER BY 1;
    `,
    {
      replacements: { ingestionRunId },
      type: QueryTypes.SELECT,
    },
  );
}

const parseArnPart = (arn: string, index: number): string => {
  const parts = arn.split(":");
  return normalizeTrim(parts[index] ?? "");
};

const inferAccountAndRegionFromFacts = (
  resourceIds: string[],
): { accountId: string | null; region: string | null } => {
  for (const raw of resourceIds) {
    const id = normalizeTrim(raw);
    if (!id.toLowerCase().startsWith("arn:aws")) continue;
    const region = parseArnPart(id, 3);
    const accountId = parseArnPart(id, 4);
    if (region && accountId) return { accountId, region };
  }
  return { accountId: null, region: null };
};

const toCanonicalLoadBalancerArn = (
  resourceId: string,
  accountId: string,
  region: string,
): string | null => {
  const id = normalizeTrim(resourceId);
  const lower = id.toLowerCase();
  if (!id) return null;

  if (lower.startsWith("arn:aws") && lower.includes(":elasticloadbalancing:")) {
    return id;
  }

  if (lower.startsWith("app/") || lower.startsWith("net/")) {
    return `arn:aws:elasticloadbalancing:${region}:${accountId}:loadbalancer/${id}`;
  }

  return null;
};

const parseAccountAndRegionFromCanonicalArn = (
  arn: string,
): { accountId: string | null; region: string | null } => {
  const lower = arn.toLowerCase();
  if (!lower.startsWith("arn:aws")) return { accountId: null, region: null };
  const parts = arn.split(":");
  if (parts.length < 6) return { accountId: null, region: null };
  const region = normalizeTrim(parts[3]);
  const accountId = normalizeTrim(parts[4]);
  return {
    accountId: accountId || null,
    region: region || null,
  };
};

async function resolveCloudConnectionIdFromBillingSource(
  fallbackCloudConnectionId: string,
  billingSourceId: string | null,
): Promise<string> {
  if (!billingSourceId) return fallbackCloudConnectionId;
  const source = await BillingSource.findByPk(billingSourceId);
  const fromSource = normalizeTrim(source?.cloudConnectionId ? String(source.cloudConnectionId) : "");
  return fromSource || fallbackCloudConnectionId;
}

async function seedLoadBalancerCoreRow(input: {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  arn: string;
  scheme?: "internet-facing" | "internal";
}): Promise<void> {
  const lbType = classifyLbType(input.arn);
  const lbName = deriveNameFromArn(input.arn);

  await LoadBalancer.upsert({
    cloudConnectionId: input.cloudConnectionId,
    accountId: input.accountId,
    region: input.region,
    arn: input.arn,
    name: lbName,
    type: lbType,
    scheme: input.scheme ?? "internet-facing",
    state: "active",
    vpcId: "vpc-seed-lb-123",
    dnsName: deriveDnsName(lbName, input.region),
    createdAtAws: new Date(),
    securityGroups: lbType === "application" ? ["sg-seed-alb"] : [],
    availabilityZones: [
      { zoneName: `${input.region}a`, subnetId: "subnet-seed-a" },
      { zoneName: `${input.region}b`, subnetId: "subnet-seed-b" },
    ],
    tags: { SeededBy: "seed-load-balancer-inventory-dummy-data" },
    listenerCount: 1,
    targetGroupCount: 1,
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedTargetGroupAndListener(input: {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  lbArn: string;
}): Promise<void> {
  const lbName = deriveNameFromArn(input.lbArn);
  const suffix = lbName.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 16) || "dummy";
  const tgArn = `arn:aws:elasticloadbalancing:${input.region}:${input.accountId}:targetgroup/${suffix}-tg/seed1234567890`;
  const listenerArn = `${input.lbArn.replace(":loadbalancer/", ":listener/")}/seed-listener-443`;

  await LoadBalancerTargetGroup.upsert({
    cloudConnectionId: input.cloudConnectionId,
    accountId: input.accountId,
    region: input.region,
    arn: tgArn,
    name: `${suffix}-tg`,
    loadBalancerArn: input.lbArn,
    protocol: classifyLbType(input.lbArn) === "network" ? "TCP" : "HTTP",
    port: classifyLbType(input.lbArn) === "network" ? 443 : 80,
    targetType: "instance",
    vpcId: "vpc-seed-lb-123",
    healthCheckProtocol: classifyLbType(input.lbArn) === "network" ? "TCP" : "HTTP",
    healthCheckPath: classifyLbType(input.lbArn) === "network" ? null : "/health",
    healthyTargetCount: 2,
    unhealthyTargetCount: 0,
    tags: { SeededBy: "seed-load-balancer-inventory-dummy-data" },
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await LoadBalancerListener.upsert({
    cloudConnectionId: input.cloudConnectionId,
    accountId: input.accountId,
    region: input.region,
    arn: listenerArn,
    loadBalancerArn: input.lbArn,
    protocol: classifyLbType(input.lbArn) === "network" ? "TCP" : "HTTP",
    port: classifyLbType(input.lbArn) === "network" ? 443 : 80,
    sslPolicy: null,
    certificates: [],
    defaultActions: [{ type: "forward", targetGroupArn: tgArn }],
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const buildDateSeries = (days: number): string[] => {
  const out: string[] = [];
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(todayUtc.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(toDateOnly(d));
  }
  return out;
};

const weekdayTrafficFactor = (dateIso: string): number => {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  const day = d.getUTCDay();
  if (day === 0) return 0.62;
  if (day === 6) return 0.75;
  return 1;
};

const trendFactor = (index: number, totalDays: number): number => {
  const progress = totalDays <= 1 ? 1 : index / (totalDays - 1);
  return 0.9 + progress * 0.2;
};

const waveFactor = (index: number): number => 1 + 0.12 * Math.sin(index / 2.4);

const clamp = (value: number, min: number): number => (value < min ? min : value);

const metricForProfile = (
  profile: SeedLoadBalancerProfile,
  dateIso: string,
  dayIndex: number,
  totalDays: number,
): DailyMetricSeedRow => {
  const lbType = classifyLbType(profile.arn);
  const weekday = weekdayTrafficFactor(dateIso);
  const trend = trendFactor(dayIndex, totalDays);
  const wave = waveFactor(dayIndex);
  const noisy = profile.reliabilityClass === "noisy";

  const scaleBase =
    profile.trafficClass === "high"
      ? 1
      : profile.trafficClass === "low"
        ? 0.09
        : 0.012;

  if (lbType === "application") {
    const baseReq = 2_800_000 * scaleBase;
    const requestCount = Math.round(clamp(baseReq * weekday * trend * wave, 100));
    const avgPayloadBytes = profile.trafficClass === "high" ? 6_800 : profile.trafficClass === "low" ? 5_100 : 3_800;
    const processedBytes = Math.round(requestCount * avgPayloadBytes * (0.95 + 0.1 * Math.sin(dayIndex / 3.1)));
    const processedGb = processedBytes / (1024 ** 3);

    const activeConnectionCount = Math.round(clamp((requestCount / 7_000) * (profile.scheme === "internal" ? 0.75 : 1), 1));
    const newConnectionCount = Math.round(clamp(requestCount * 0.11, 1));

    const healthyHostCount = profile.trafficClass === "high" ? 6 : profile.trafficClass === "low" ? 3 : 2;
    const unhealthyBase = noisy ? (dayIndex % 4 === 0 ? 1 : 0) : dayIndex % 13 === 0 ? 1 : 0;
    const unhealthyHostCount = unhealthyBase;

    const baseLatency = profile.trafficClass === "high" ? 0.165 : profile.trafficClass === "low" ? 0.085 : 0.06;
    const latencyPenalty = noisy ? 0.045 : 0.012;
    const targetResponseTimeAvg = Math.max(0.02, baseLatency + unhealthyHostCount * latencyPenalty + 0.02 * Math.sin(dayIndex / 4.7));

    const elb5xxCount = noisy
      ? Math.round(clamp(requestCount * 0.00012 + 14 * (1 + Math.sin(dayIndex / 2.2)), 0))
      : Math.round(clamp(requestCount * 0.000015 + 2, 0));

    const target5xxCount = noisy
      ? Math.round(clamp(requestCount * 0.00023 + 22 * (1 + Math.cos(dayIndex / 2.5)), 0))
      : Math.round(clamp(requestCount * 0.000035 + 4, 0));

    return {
      requestCount,
      processedBytes,
      processedGb,
      activeConnectionCount,
      newConnectionCount,
      activeFlowCount: 0,
      newFlowCount: 0,
      healthyHostCount,
      unhealthyHostCount,
      targetResponseTimeAvg,
      elb5xxCount,
      target5xxCount,
      tcpTargetResetCount: 0,
    };
  }

  const baseFlows = profile.trafficClass === "high" ? 10_500_000 : profile.trafficClass === "low" ? 1_300_000 : 220_000;
  const newFlowCount = Math.round(clamp(baseFlows * weekday * trend * wave, 100));
  const activeFlowCount = Math.round(clamp(newFlowCount * 0.16, 10));

  const bytesPerFlow = profile.trafficClass === "high" ? 4_200 : profile.trafficClass === "low" ? 2_600 : 1_500;
  const processedBytes = Math.round(newFlowCount * bytesPerFlow * (0.93 + 0.11 * Math.cos(dayIndex / 3.2)));
  const processedGb = processedBytes / (1024 ** 3);

  const healthyHostCount = profile.trafficClass === "high" ? 5 : profile.trafficClass === "low" ? 3 : 2;
  const unhealthyHostCount = noisy ? (dayIndex % 5 === 0 ? 1 : 0) : dayIndex % 19 === 0 ? 1 : 0;
  const tcpTargetResetCount = noisy
    ? Math.round(clamp(newFlowCount * 0.00018 + 9 * (1 + Math.sin(dayIndex / 2.6)), 0))
    : Math.round(clamp(newFlowCount * 0.00004 + 2, 0));

  return {
    requestCount: 0,
    processedBytes,
    processedGb,
    activeConnectionCount: 0,
    newConnectionCount: 0,
    activeFlowCount,
    newFlowCount,
    healthyHostCount,
    unhealthyHostCount,
    targetResponseTimeAvg: 0,
    elb5xxCount: 0,
    target5xxCount: 0,
    tcpTargetResetCount,
  };
};

const costForMetric = (profile: SeedLoadBalancerProfile, metric: DailyMetricSeedRow): {
  fixedCost: number;
  lcuCost: number;
  dataProcessingCost: number;
  usageQuantity: number;
  totalCost: number;
  lineItemCount: number;
} => {
  const lbType = classifyLbType(profile.arn);
  const fixedCost = lbType === "application" ? 0.44 : 0.31;

  const usageQuantity =
    lbType === "application"
      ? Math.max(
          metric.requestCount / 1_000_000,
          metric.processedGb / 0.5,
          metric.activeConnectionCount / 3_000,
          metric.newConnectionCount / 1_000_000,
        )
      : Math.max(
          metric.newFlowCount / 1_000_000,
          metric.activeFlowCount / 250_000,
          metric.processedGb / 0.8,
        );

  const lcuRate = lbType === "application" ? 0.82 : 0.54;
  const lcuCost = usageQuantity * lcuRate;
  const dataProcessingCost = metric.processedGb * (lbType === "application" ? 0.013 : 0.009);
  const totalCost = fixedCost + lcuCost + dataProcessingCost;
  const lineItemCount = lbType === "application" ? 4 : 3;

  return { fixedCost, lcuCost, dataProcessingCost, usageQuantity, totalCost, lineItemCount };
};

async function seedDailyCostAndMetrics(input: {
  profile: SeedLoadBalancerProfile;
  dateSeries: string[];
}): Promise<{ costRows: number; metricsRows: number }> {
  let costRows = 0;
  let metricsRows = 0;

  for (let i = 0; i < input.dateSeries.length; i += 1) {
    const dateIso = input.dateSeries[i];
    const metric = metricForProfile(input.profile, dateIso, i, input.dateSeries.length);
    const cost = costForMetric(input.profile, metric);

    await LoadBalancerMetricsDaily.upsert({
      cloudConnectionId: input.profile.cloudConnectionId,
      accountId: input.profile.accountId,
      region: input.profile.region,
      loadBalancerArn: input.profile.arn,
      metricDate: dateIso,
      requestCount: metric.requestCount,
      processedBytes: metric.processedBytes,
      processedGb: metric.processedGb.toFixed(6),
      activeConnectionCount: metric.activeConnectionCount,
      newConnectionCount: metric.newConnectionCount,
      activeFlowCount: metric.activeFlowCount,
      newFlowCount: metric.newFlowCount,
      healthyHostCount: metric.healthyHostCount.toFixed(4),
      unhealthyHostCount: metric.unhealthyHostCount.toFixed(4),
      targetResponseTimeAvg: metric.targetResponseTimeAvg.toFixed(6),
      elb5xxCount: metric.elb5xxCount,
      target5xxCount: metric.target5xxCount,
      tcpTargetResetCount: metric.tcpTargetResetCount,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    metricsRows += 1;

    await LoadBalancerCostDaily.upsert({
      cloudConnectionId: input.profile.cloudConnectionId,
      accountId: input.profile.accountId,
      region: input.profile.region,
      loadBalancerArn: input.profile.arn,
      usageDate: dateIso,
      totalCost: cost.totalCost.toFixed(6),
      fixedCost: cost.fixedCost.toFixed(6),
      lcuCost: cost.lcuCost.toFixed(6),
      dataProcessingCost: cost.dataProcessingCost.toFixed(6),
      processedBytesGb: metric.processedGb.toFixed(6),
      usageQuantity: cost.usageQuantity.toFixed(6),
      currencyCode: "USD",
      lineItemCount: cost.lineItemCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    costRows += 1;
  }

  return { costRows, metricsRows };
}

function buildDefaultProfiles(input: {
  cloudConnectionId: string;
  accountId: string;
  primaryRegion: string;
}): SeedLoadBalancerProfile[] {
  const secondaryRegion = input.primaryRegion === "us-east-1" ? "us-west-2" : "us-east-1";

  return [
    {
      cloudConnectionId: input.cloudConnectionId,
      accountId: input.accountId,
      region: input.primaryRegion,
      arn: `arn:aws:elasticloadbalancing:${input.primaryRegion}:${input.accountId}:loadbalancer/app/prod-payments-alb/aa11bb22cc33`,
      scheme: "internet-facing",
      trafficClass: "high",
      reliabilityClass: "stable",
    },
    {
      cloudConnectionId: input.cloudConnectionId,
      accountId: input.accountId,
      region: input.primaryRegion,
      arn: `arn:aws:elasticloadbalancing:${input.primaryRegion}:${input.accountId}:loadbalancer/app/internal-backoffice-alb/dd44ee55ff66`,
      scheme: "internal",
      trafficClass: "low",
      reliabilityClass: "noisy",
    },
    {
      cloudConnectionId: input.cloudConnectionId,
      accountId: input.accountId,
      region: secondaryRegion,
      arn: `arn:aws:elasticloadbalancing:${secondaryRegion}:${input.accountId}:loadbalancer/net/prod-streaming-nlb/1122aabb3344`,
      scheme: "internet-facing",
      trafficClass: "high",
      reliabilityClass: "stable",
    },
    {
      cloudConnectionId: input.cloudConnectionId,
      accountId: input.accountId,
      region: secondaryRegion,
      arn: `arn:aws:elasticloadbalancing:${secondaryRegion}:${input.accountId}:loadbalancer/net/idle-batch-nlb/5566ccdd7788`,
      scheme: "internal",
      trafficClass: "idle",
      reliabilityClass: "noisy",
    },
  ];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.cloudConnectionId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  let arnsToSeed: Array<{ arn: string; cloudConnectionId: string; accountId: string; region: string }> = [];

  if (args.ingestionRunId) {
    const factArns = await resolveArnsFromIngestionRun(args.ingestionRunId);
    if (factArns.length === 0) {
      throw new Error(`No LB resource ids found in fact_cost_line_items for ingestion_run_id=${args.ingestionRunId}`);
    }

    const rawIds = factArns.map((row) => normalizeTrim(row.arn)).filter(Boolean);
    const inferred = inferAccountAndRegionFromFacts(rawIds);
    const resolvedAccountId = args.accountId || inferred.accountId || "";
    const resolvedRegion = args.region || inferred.region || "";
    if (!resolvedAccountId || !resolvedRegion) {
      throw new Error(
        "Unable to resolve account/region. Provide --account-id and --region, or include at least one full ELB ARN in CUR facts.",
      );
    }
    args.accountId = resolvedAccountId;
    args.region = resolvedRegion;

    for (const row of factArns) {
      const rawResourceId = normalizeTrim(row.arn);
      if (!rawResourceId) continue;
      const canonicalArn = toCanonicalLoadBalancerArn(rawResourceId, args.accountId, args.region);
      if (!canonicalArn) continue;
      const ccId = await resolveCloudConnectionIdFromBillingSource(args.cloudConnectionId, row.billing_source_id);
      const parsed = parseAccountAndRegionFromCanonicalArn(canonicalArn);
      const accountIdForRow = parsed.accountId || args.accountId;
      const regionForRow = parsed.region || args.region;
      arnsToSeed.push({
        arn: canonicalArn,
        cloudConnectionId: ccId,
        accountId: accountIdForRow,
        region: regionForRow,
      });
      if (args.includeRawResourceIdAlias && rawResourceId !== canonicalArn) {
        arnsToSeed.push({
          arn: rawResourceId,
          cloudConnectionId: ccId,
          accountId: accountIdForRow,
          region: regionForRow,
        });
      }
    }
  } else {
    if (!args.accountId || !args.region) {
      throw new Error("When --ingestion-run-id is not provided, --account-id and --region are required.");
    }
    const defaults = buildDefaultProfiles({
      cloudConnectionId: args.cloudConnectionId,
      accountId: args.accountId,
      primaryRegion: args.region,
    });
    arnsToSeed = defaults.map((row) => ({
      arn: row.arn,
      cloudConnectionId: row.cloudConnectionId,
      accountId: row.accountId,
      region: row.region,
    }));
  }

  const uniqueByArn = new Map<string, { arn: string; cloudConnectionId: string; accountId: string; region: string }>();
  for (const item of arnsToSeed) {
    const key = `${item.cloudConnectionId}|${item.accountId}|${item.region}|${item.arn.toLowerCase()}`;
    uniqueByArn.set(key, item);
  }

  const defaultProfileByArn = new Map<string, SeedLoadBalancerProfile>();
  if (!args.ingestionRunId) {
    for (const profile of buildDefaultProfiles({
      cloudConnectionId: args.cloudConnectionId,
      accountId: args.accountId,
      primaryRegion: args.region,
    })) {
      defaultProfileByArn.set(`${profile.cloudConnectionId}|${profile.accountId}|${profile.region}|${profile.arn.toLowerCase()}`, profile);
    }
  }

  let lbCount = 0;
  let tgCount = 0;
  let listenerCount = 0;
  let costRows = 0;
  let metricsRows = 0;

  const dateSeries = buildDateSeries(21);

  for (const [key, item] of uniqueByArn.entries()) {
    const profile =
      defaultProfileByArn.get(key) ??
      ({
        cloudConnectionId: item.cloudConnectionId,
        accountId: item.accountId,
        region: item.region,
        arn: item.arn,
        scheme: classifyLbType(item.arn) === "application" ? "internet-facing" : "internal",
        trafficClass: classifyLbType(item.arn) === "application" ? "low" : "idle",
        reliabilityClass: "stable",
      } satisfies SeedLoadBalancerProfile);

    await seedLoadBalancerCoreRow({
      cloudConnectionId: item.cloudConnectionId,
      accountId: item.accountId,
      region: item.region,
      arn: item.arn,
      scheme: profile.scheme,
    });
    lbCount += 1;

    await seedTargetGroupAndListener({
      cloudConnectionId: item.cloudConnectionId,
      accountId: item.accountId,
      region: item.region,
      lbArn: item.arn,
    });
    tgCount += 1;
    listenerCount += 1;

    const seeded = await seedDailyCostAndMetrics({ profile, dateSeries });
    costRows += seeded.costRows;
    metricsRows += seeded.metricsRows;
  }

  console.info("Load balancer dev seed completed", {
    cloudConnectionId: args.cloudConnectionId,
    accountId: args.accountId,
    region: args.region,
    ingestionRunId: args.ingestionRunId,
    daysSeeded: dateSeries.length,
    loadBalancersUpserted: lbCount,
    targetGroupsUpserted: tgCount,
    listenersUpserted: listenerCount,
    costRowsUpserted: costRows,
    metricsRowsUpserted: metricsRows,
  });
}

main()
  .catch((error) => {
    console.error(
      "Load balancer dev seed failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
