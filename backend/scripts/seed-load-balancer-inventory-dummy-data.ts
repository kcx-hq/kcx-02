// @ts-nocheck
import { QueryTypes } from "sequelize";

import {
  BillingSource,
  LoadBalancer,
  LoadBalancerListener,
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
  - If not provided, script inserts two demo ARNs (ALB + NLB).
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
    scheme: "internet-facing",
    state: "active",
    vpcId: "vpc-dummy123",
    dnsName: deriveDnsName(lbName, input.region),
    createdAtAws: new Date(),
    securityGroups: [],
    availabilityZones: [
      { zoneName: `${input.region}a`, subnetId: "subnet-dummy-a" },
      { zoneName: `${input.region}b`, subnetId: "subnet-dummy-b" },
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
    vpcId: "vpc-dummy123",
    healthCheckProtocol: classifyLbType(input.lbArn) === "network" ? "TCP" : "HTTP",
    healthCheckPath: classifyLbType(input.lbArn) === "network" ? null : "/health",
    healthyTargetCount: 1,
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
    arnsToSeed = [
      {
        cloudConnectionId: args.cloudConnectionId,
        accountId: args.accountId,
        region: args.region,
        arn: `arn:aws:elasticloadbalancing:${args.region}:${args.accountId}:loadbalancer/app/kcx-demo-alb/abc123def456`,
      },
      {
        cloudConnectionId: args.cloudConnectionId,
        accountId: args.accountId,
        region: args.region,
        arn: `arn:aws:elasticloadbalancing:${args.region}:${args.accountId}:loadbalancer/net/kcx-demo-nlb/789ghi012jkl`,
      },
    ];
  }

  const uniqueByArn = new Map<string, { arn: string; cloudConnectionId: string; accountId: string; region: string }>();
  for (const item of arnsToSeed) {
    const key = `${item.cloudConnectionId}|${item.accountId}|${item.region}|${item.arn.toLowerCase()}`;
    uniqueByArn.set(key, item);
  }

  let lbCount = 0;
  let tgCount = 0;
  let listenerCount = 0;
  for (const item of uniqueByArn.values()) {
    await seedLoadBalancerCoreRow({
      cloudConnectionId: item.cloudConnectionId,
      accountId: item.accountId,
      region: item.region,
      arn: item.arn,
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
  }

  console.info("Load balancer dummy inventory seed completed", {
    cloudConnectionId: args.cloudConnectionId,
    accountId: args.accountId,
    region: args.region,
    ingestionRunId: args.ingestionRunId,
    loadBalancersUpserted: lbCount,
    targetGroupsUpserted: tgCount,
    listenersUpserted: listenerCount,
  });
}

main()
  .catch((error) => {
    console.error(
      "Load balancer dummy inventory seed failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
