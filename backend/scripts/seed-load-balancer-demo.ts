import { QueryTypes } from "sequelize";
import {
  CloudConnectionV2,
  CloudProvider,
  FactRecommendations,
  LoadBalancer,
  LoadBalancerCostDaily,
  LoadBalancerListener,
  LoadBalancerMetricsDaily,
  LoadBalancerTargetGroup,
  Tenant,
  sequelize,
} from "../src/models/index.js";
import { LoadBalancerRecommendationsService } from "../src/features/load-balancer/recommendations/load-balancer-recommendations.service.js";

type CloudScope = {
  tenantId: string;
  cloudConnectionId: string;
  accountId: string;
};

type LbSeedProfile = {
  name: string;
  type: "application" | "network";
  scheme: "internet-facing" | "internal";
  state: "active";
  region: "us-east-1" | "us-west-2";
  accountId: string;
  hash: string;
  traffic: "very_high" | "high" | "moderate" | "low" | "idle";
  unhealthyHosts: number;
  errorRatePercent: number;
  dataProcessingWeight: number;
  tags: Record<string, string>;
};

const SOURCE_SYSTEM = "KCX_LOAD_BALANCER_OPTIMIZATION_V1";
const DAYS_TO_SEED = 30;

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));
const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const startOfUtcDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const bytesFromGb = (gb: number): number => Math.round(gb * 1024 * 1024 * 1024);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const stableNoise = (key: string, dayIndex: number): number => {
  const raw = `${key}:${dayIndex}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 0xffffffff;
  return normalized - 0.5;
};

const makeArn = (profile: LbSeedProfile): string =>
  `arn:aws:elasticloadbalancing:${profile.region}:${profile.accountId}:loadbalancer/${profile.type === "application" ? "app" : "net"}/${profile.name}/${profile.hash}`;

async function ensureCloudScope(): Promise<CloudScope> {
  const existingAws = await sequelize.query<{
    tenantId: string;
    cloudConnectionId: string;
    accountId: string | null;
  }>(
    `
    SELECT
      cc.tenant_id::text AS "tenantId",
      cc.id::text AS "cloudConnectionId",
      NULLIF(TRIM(cc.cloud_account_id), '') AS "accountId"
    FROM cloud_connections cc
    JOIN cloud_providers cp ON cp.id = cc.provider_id
    WHERE LOWER(COALESCE(cp.code, '')) = 'aws'
    ORDER BY
      CASE WHEN LOWER(COALESCE(cc.status::text, '')) IN ('active', 'active_with_warnings') THEN 0 ELSE 1 END,
      cc.updated_at DESC
    LIMIT 1;
    `,
    { type: QueryTypes.SELECT },
  );

  if (existingAws[0]) {
    return {
      tenantId: existingAws[0].tenantId,
      cloudConnectionId: existingAws[0].cloudConnectionId,
      accountId: existingAws[0].accountId ?? "123456789012",
    };
  }

  const provider =
    (await CloudProvider.findOne({ where: { code: "aws" } })) ??
    (await CloudProvider.create({ code: "aws", name: "Amazon Web Services", status: "active" } as never));
  const tenant =
    (await Tenant.findOne({ order: [["createdAt", "ASC"]] })) ??
    (await Tenant.create({ name: "LB Demo Tenant", slug: "lb-demo-tenant", status: "active" } as never));

  const demoConnection = await CloudConnectionV2.create(
    {
      tenantId: tenant.id,
      providerId: String(provider.id),
      connectionName: "Load Balancer Demo Connection",
      accountType: "payer",
      status: "active",
      region: "us-east-1",
      cloudAccountId: "123456789012",
      payerAccountId: "123456789012",
      createdBy: null,
      connectedAt: new Date(),
      lastValidatedAt: new Date(),
    } as never,
  );

  return {
    tenantId: tenant.id,
    cloudConnectionId: demoConnection.id,
    accountId: demoConnection.cloudAccountId ?? "123456789012",
  };
}

function buildProfiles(accountId: string): LbSeedProfile[] {
  return [
    {
      name: "prod-public-alb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      region: "us-east-1",
      accountId,
      hash: "a1b2c3d4e5f6g7h8",
      traffic: "very_high",
      unhealthyHosts: 0,
      errorRatePercent: 0.12,
      dataProcessingWeight: 0.3,
      tags: { Name: "prod-public-alb", team: "platform", product: "web", environment: "prod" },
    },
    {
      name: "dev-idle-alb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      region: "us-east-1",
      accountId,
      hash: "b1c2d3e4f5g6h7i8",
      traffic: "idle",
      unhealthyHosts: 0,
      errorRatePercent: 0,
      dataProcessingWeight: 0.05,
      tags: { Name: "dev-idle-alb", team: "devex", product: "sandbox", environment: "dev" },
    },
    {
      name: "internal-low-traffic-alb",
      type: "application",
      scheme: "internal",
      state: "active",
      region: "us-west-2",
      accountId,
      hash: "c1d2e3f4g5h6i7j8",
      traffic: "low",
      unhealthyHosts: 0,
      errorRatePercent: 0.04,
      dataProcessingWeight: 0.12,
      tags: { Name: "internal-low-traffic-alb", team: "ops", product: "backoffice", environment: "staging" },
    },
    {
      name: "api-error-alb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      region: "us-east-1",
      accountId,
      hash: "d1e2f3g4h5i6j7k8",
      traffic: "high",
      unhealthyHosts: 0,
      errorRatePercent: 4.6,
      dataProcessingWeight: 0.2,
      tags: { Name: "api-error-alb", team: "payments", product: "api", environment: "prod" },
    },
    {
      name: "unhealthy-target-alb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      region: "us-west-2",
      accountId,
      hash: "e1f2g3h4i5j6k7l8",
      traffic: "moderate",
      unhealthyHosts: 2,
      errorRatePercent: 0.7,
      dataProcessingWeight: 0.18,
      tags: { Name: "unhealthy-target-alb", team: "orders", product: "checkout", environment: "prod" },
    },
    {
      name: "data-heavy-nlb",
      type: "network",
      scheme: "internet-facing",
      state: "active",
      region: "us-east-1",
      accountId,
      hash: "f1g2h3i4j5k6l7m8",
      traffic: "high",
      unhealthyHosts: 0,
      errorRatePercent: 0.03,
      dataProcessingWeight: 0.8,
      tags: { Name: "data-heavy-nlb", team: "streaming", product: "media", environment: "prod" },
    },
    {
      name: "internal-nlb",
      type: "network",
      scheme: "internal",
      state: "active",
      region: "us-west-2",
      accountId,
      hash: "g1h2i3j4k5l6m7n8",
      traffic: "moderate",
      unhealthyHosts: 0,
      errorRatePercent: 0.02,
      dataProcessingWeight: 0.25,
      tags: { Name: "internal-nlb", team: "platform", product: "mesh", environment: "staging" },
    },
    {
      name: "staging-balanced-alb",
      type: "application",
      scheme: "internet-facing",
      state: "active",
      region: "us-west-2",
      accountId,
      hash: "h1i2j3k4l5m6n7o8",
      traffic: "moderate",
      unhealthyHosts: 0,
      errorRatePercent: 0.05,
      dataProcessingWeight: 0.22,
      tags: { Name: "staging-balanced-alb", team: "platform", product: "web", environment: "staging" },
    },
  ];
}

function dailyTrafficBaseline(profile: LbSeedProfile): { requests: number; gb: number; active: number; isIdle: boolean } {
  if (profile.traffic === "very_high") return { requests: 2_400_000, gb: 220, active: 2500, isIdle: false };
  if (profile.traffic === "high") return { requests: 850_000, gb: 140, active: 1200, isIdle: false };
  if (profile.traffic === "moderate") return { requests: 120_000, gb: 18, active: 170, isIdle: false };
  if (profile.traffic === "low") return { requests: 1500, gb: 0.18, active: 2, isIdle: false };
  return { requests: 1, gb: 0.001, active: 0, isIdle: true };
}

function deterministicChance(key: string, dayIndex: number): number {
  return stableNoise(`${key}:chance`, dayIndex) + 0.5;
}

async function seedDemoData(scope: CloudScope): Promise<void> {
  const now = new Date();
  const end = startOfUtcDay(now);
  const start = addDays(end, -(DAYS_TO_SEED - 1));
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(toDateOnly(d));

  const profiles = buildProfiles(scope.accountId);

  const deleted = await sequelize.transaction(async (transaction) => {
    const lbRecRows = await sequelize.query<{ id: number }>(
      `
      SELECT fr.id
      FROM fact_recommendations fr
      WHERE fr.source_system = :sourceSystem
        AND fr.tenant_id = :tenantId
        AND fr.cloud_connection_id = :cloudConnectionId
      `,
      {
        replacements: {
          sourceSystem: SOURCE_SYSTEM,
          tenantId: scope.tenantId,
          cloudConnectionId: scope.cloudConnectionId,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    const lbRecIds = lbRecRows.map((r) => Number(r.id)).filter((v) => Number.isFinite(v));

    const actionsTableExists = await sequelize.query<{ exists: boolean }>(
      `
      SELECT to_regclass('public.fact_recommendation_actions') IS NOT NULL AS "exists"
      `,
      { type: QueryTypes.SELECT, transaction },
    );
    const deletedActions =
      lbRecIds.length && actionsTableExists[0]?.exists
        ? await sequelize.query<{ count: string }>(
            `
            DELETE FROM fact_recommendation_actions
            WHERE recommendation_id IN (:recIds)
            RETURNING 1::text AS count
            `,
            { replacements: { recIds: lbRecIds }, type: QueryTypes.SELECT, transaction },
          )
        : [];

    const deletedRecs = await FactRecommendations.destroy({
      where: {
        sourceSystem: SOURCE_SYSTEM,
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId,
      } as never,
      transaction,
    });
    const lbWhere = { cloudConnectionId: scope.cloudConnectionId, accountId: scope.accountId } as never;
    const deletedCost = await LoadBalancerCostDaily.destroy({ where: lbWhere, truncate: false, transaction });
    const deletedMetrics = await LoadBalancerMetricsDaily.destroy({ where: lbWhere, truncate: false, transaction });
    const deletedListeners = await LoadBalancerListener.destroy({ where: lbWhere, truncate: false, transaction });
    const deletedTargetGroups = await LoadBalancerTargetGroup.destroy({ where: lbWhere, truncate: false, transaction });
    const deletedLbs = await LoadBalancer.destroy({ where: lbWhere, truncate: false, transaction });

    return {
      deletedActions: deletedActions.length,
      deletedRecs,
      deletedCost,
      deletedMetrics,
      deletedListeners,
      deletedTargetGroups,
      deletedLbs,
    };
  });

  console.info("LB cleanup completed", deleted);

  let lbRows = 0;
  let tgRows = 0;
  let listenerRows = 0;
  let costRows = 0;
  let metricRows = 0;

  await sequelize.transaction(async (transaction) => {
    for (const profile of profiles) {
      const lbArn = makeArn(profile);

      await LoadBalancer.create(
        {
          cloudConnectionId: scope.cloudConnectionId,
          accountId: profile.accountId,
          region: profile.region,
          arn: lbArn,
          name: profile.name,
          type: profile.type,
          scheme: profile.scheme,
          state: profile.state,
          vpcId: `vpc-${profile.region === "us-east-1" ? "1a2b3c4d" : "5e6f7a8b"}`,
          dnsName: `${profile.name}-${profile.hash.slice(0, 8)}.${profile.region}.elb.amazonaws.com`,
          createdAtAws: addDays(now, -120),
          securityGroups: profile.type === "application" ? ["sg-0a1b2c3d4e5f6a7b8"] : [],
          availabilityZones: [
            { zoneName: `${profile.region}a`, subnetId: `subnet-${profile.hash.slice(0, 8)}` },
            { zoneName: `${profile.region}b`, subnetId: `subnet-${profile.hash.slice(8, 16)}` },
          ],
          tags: profile.tags,
          listenerCount: profile.type === "application" ? 2 : 1,
          targetGroupCount: profile.type === "application" ? 2 : 1,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        } as never,
        { transaction },
      );
      lbRows += 1;

      const tgBaseArn = `arn:aws:elasticloadbalancing:${profile.region}:${profile.accountId}:targetgroup/${profile.name}-tg`;
      const primaryTgArn = `${tgBaseArn}1/${profile.hash.slice(0, 12)}`;
      const secondaryTgArn = `${tgBaseArn}2/${profile.hash.slice(4, 16)}`;
      const healthUnhealthy = profile.unhealthyHosts > 0 ? profile.unhealthyHosts : 0;
      const healthHealthy = profile.unhealthyHosts > 0 ? 2 : profile.type === "application" ? 4 : 3;

      await LoadBalancerTargetGroup.create(
        {
          cloudConnectionId: scope.cloudConnectionId,
          accountId: profile.accountId,
          region: profile.region,
          arn: primaryTgArn,
          name: `${profile.name}-tg-primary`,
          loadBalancerArn: lbArn,
          protocol: profile.type === "network" ? "TCP" : "HTTP",
          port: profile.type === "network" ? 443 : 80,
          targetType: "instance",
          vpcId: `vpc-${profile.region === "us-east-1" ? "1a2b3c4d" : "5e6f7a8b"}`,
          healthCheckProtocol: profile.type === "network" ? "TCP" : "HTTP",
          healthCheckPath: profile.type === "application" ? "/health" : null,
          healthyTargetCount: healthHealthy,
          unhealthyTargetCount: healthUnhealthy,
          tags: { ...profile.tags, tier: "primary" },
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        } as never,
        { transaction },
      );
      tgRows += 1;

      if (profile.type === "application") {
        await LoadBalancerTargetGroup.create(
          {
            cloudConnectionId: scope.cloudConnectionId,
            accountId: profile.accountId,
            region: profile.region,
            arn: secondaryTgArn,
            name: `${profile.name}-tg-secondary`,
            loadBalancerArn: lbArn,
            protocol: "HTTP",
            port: 8080,
            targetType: "instance",
            vpcId: `vpc-${profile.region === "us-east-1" ? "1a2b3c4d" : "5e6f7a8b"}`,
            healthCheckProtocol: "HTTP",
            healthCheckPath: "/healthz",
            healthyTargetCount: Math.max(1, healthHealthy - 1),
            unhealthyTargetCount: healthUnhealthy > 0 ? 1 : 0,
            tags: { ...profile.tags, tier: "secondary" },
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          } as never,
          { transaction },
        );
        tgRows += 1;
      }

      const listenerBaseArn = lbArn.replace(":loadbalancer/", ":listener/");
      await LoadBalancerListener.create(
        {
          cloudConnectionId: scope.cloudConnectionId,
          accountId: profile.accountId,
          region: profile.region,
          arn: `${listenerBaseArn}/${profile.hash.slice(0, 10)}`,
          loadBalancerArn: lbArn,
          protocol: profile.type === "network" ? "TCP" : "HTTP",
          port: profile.type === "network" ? 443 : 80,
          sslPolicy: profile.type === "application" ? null : "ELBSecurityPolicy-TLS13-1-2-2021-06",
          certificates: profile.type === "application" ? [] : [{ certificateArn: `arn:aws:acm:${profile.region}:${profile.accountId}:certificate/${profile.hash}` }],
          defaultActions: [{ type: "forward", targetGroupArn: primaryTgArn }],
          tags: profile.tags,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        } as never,
        { transaction },
      );
      listenerRows += 1;

      if (profile.type === "application") {
        await LoadBalancerListener.create(
          {
            cloudConnectionId: scope.cloudConnectionId,
            accountId: profile.accountId,
            region: profile.region,
            arn: `${listenerBaseArn}/${profile.hash.slice(2, 12)}`,
            loadBalancerArn: lbArn,
            protocol: "HTTPS",
            port: 443,
            sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
            certificates: [{ certificateArn: `arn:aws:acm:${profile.region}:${profile.accountId}:certificate/${profile.hash}` }],
            defaultActions: [{ type: "forward", targetGroupArn: primaryTgArn }],
            tags: profile.tags,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          } as never,
          { transaction },
        );
        listenerRows += 1;
      }

      const baseline = dailyTrafficBaseline(profile);
      for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
        const usageDate = dates[dayIndex];
        const dayDate = new Date(`${usageDate}T00:00:00.000Z`);
        const dayOfWeek = dayDate.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Smooth realistic shaping: weekly seasonality + short-cycle wave + gradual trend + small jitter.
        const weekendFactor = isWeekend ? (profile.scheme === "internal" ? 0.9 : 0.65) : 1;
        const weeklyWave = 1 + Math.sin((2 * Math.PI * (dayIndex + 2)) / 7) * 0.08;
        const cycleWave = 1 + Math.sin((2 * Math.PI * dayIndex) / 19 + (stableNoise(`${profile.name}:phase`, 0) + 0.5) * Math.PI) * 0.06;
        const trendSlope = clamp(stableNoise(`${profile.name}:trend`, 0) * 0.0016, -0.0012, 0.0018);
        const trendFactor = 1 + trendSlope * dayIndex;
        const jitter = 1 + stableNoise(profile.name, dayIndex) * 0.09;

        const schemeFactor = profile.scheme === "internal" ? 0.55 : 1.12;
        const typeReqFactor = profile.type === "network" ? 0.48 : 1;
        const typeConnFactor = profile.type === "network" ? 1.55 : 1;

        let demandFactor = weekendFactor * weeklyWave * cycleWave * trendFactor * jitter * schemeFactor;
        if (profile.traffic === "idle") demandFactor = Math.max(0.65, demandFactor * 0.25);
        if (profile.traffic === "low") demandFactor = Math.max(0.55, demandFactor * 0.6);

        // Rare deterministic burst days (marketing spikes, batch events), except on idle profiles.
        const burstChance = deterministicChance(`${profile.name}:burst`, dayIndex);
        const burstFactor = (profile.traffic === "idle" || profile.traffic === "low") ? 1 : (burstChance > 0.965 ? 1.18 : 1);
        demandFactor *= burstFactor;

        const requestCount = Math.max(1, Math.round(baseline.requests * typeReqFactor * demandFactor));
        let processedGb = Math.max(0.0005, baseline.gb * demandFactor);
        // NLBs typically carry fewer requests but larger payloads/streams.
        if (profile.type === "network") processedGb *= 1.35;
        if (profile.name === "data-heavy-nlb") processedGb *= 1.75;
        const processedBytes = bytesFromGb(processedGb);
        const activeConnectionCount = Math.max(0, Math.round(baseline.active * typeConnFactor * (demandFactor * 0.92 + 0.08)));
        const newConnectionCount = Math.max(1, Math.round(activeConnectionCount * (profile.type === "application" ? 2.3 : 1.25)));
        const activeFlowCount = profile.type === "network" ? Math.max(0, Math.round(activeConnectionCount * 1.22)) : 0;
        const newFlowCount = profile.type === "network" ? Math.max(0, Math.round(newConnectionCount * 1.17)) : 0;

        const baseHealthyHosts = profile.type === "application" ? 4 : 3;
        const healthyHostCount = profile.unhealthyHosts > 0 ? Math.max(1, baseHealthyHosts - profile.unhealthyHosts) : baseHealthyHosts;
        let unhealthyHostCount = 0;
        // Deterministic temporary unhealthy windows.
        if (profile.unhealthyHosts > 0) {
          const unhealthyWindow = deterministicChance(`${profile.name}:unhealthy-window`, dayIndex);
          unhealthyHostCount = unhealthyWindow > 0.77 ? profile.unhealthyHosts : 0;
        }

        // Error spikes some days; stronger for error-profile.
        const spikeChance = deterministicChance(`${profile.name}:error-spike`, dayIndex);
        const spikeMultiplier = spikeChance > 0.95 ? 2.6 : spikeChance > 0.89 ? 1.45 : 1;
        const profileErrorRatePct = profile.errorRatePercent * spikeMultiplier;
        const totalErrorCount = Math.round((requestCount * profileErrorRatePct) / 100);
        const elb5xxCount = Math.max(0, Math.round(totalErrorCount * 0.42));
        const target5xxCount = Math.max(0, Math.round(totalErrorCount * 0.58));
        const tcpTargetResetCount = profile.type === "network" ? Math.round(requestCount * 0.000022) : Math.round(requestCount * 0.00001);
        const targetResponseTimeAvg = profile.traffic === "idle"
          ? 0.005
          : profileErrorRatePct >= 2
            ? round(0.32 + deterministicChance(`${profile.name}:latency`, dayIndex) * 0.2, 6)
            : round(0.075 + deterministicChance(`${profile.name}:latency`, dayIndex) * 0.055, 6);

        const fixedCost = profile.type === "application" ? 0.55 : 0.48;
        const lcuCost = profile.type === "application"
          ? Math.max(0.01, (requestCount / 1_000_000) * 0.7 + (activeConnectionCount / 10_000) * 0.2)
          : Math.max(0.005, (activeConnectionCount / 20_000) * 0.25 + (newConnectionCount / 40_000) * 0.15);
        const dataProcessingCost = Math.max(
          0.0005,
          (processedGb * (profile.type === "application" ? 0.008 : 0.01)) * profile.dataProcessingWeight,
        );
        const totalCost = fixedCost + lcuCost + dataProcessingCost;
        const usageQuantity = profile.type === "application" ? lcuCost * 10 : processedGb;

        await LoadBalancerMetricsDaily.create(
          {
            cloudConnectionId: scope.cloudConnectionId,
            accountId: profile.accountId,
            region: profile.region,
            loadBalancerArn: lbArn,
            metricDate: usageDate,
            requestCount,
            processedBytes,
            processedGb: round(processedGb),
            activeConnectionCount,
            newConnectionCount,
            activeFlowCount,
            newFlowCount,
            healthyHostCount: round(healthyHostCount, 4),
            unhealthyHostCount: round(unhealthyHostCount, 4),
            targetResponseTimeAvg: round(targetResponseTimeAvg),
            elb5xxCount,
            target5xxCount,
            tcpTargetResetCount,
            lastSyncedAt: now,
            createdAt: now,
            updatedAt: now,
          } as never,
          { transaction },
        );
        metricRows += 1;

        await LoadBalancerCostDaily.create(
          {
            cloudConnectionId: scope.cloudConnectionId,
            accountId: profile.accountId,
            region: profile.region,
            loadBalancerArn: lbArn,
            usageDate,
            totalCost: round(totalCost),
            fixedCost: round(fixedCost),
            lcuCost: round(lcuCost),
            dataProcessingCost: round(dataProcessingCost),
            processedBytesGb: round(processedGb),
            usageQuantity: round(usageQuantity),
            currencyCode: "USD",
            lineItemCount: baseline.isIdle ? 1 : 4,
            createdAt: now,
            updatedAt: now,
          } as never,
          { transaction },
        );
        costRows += 1;
      }
    }
  });

  console.info("LB seed inserts completed", {
    loadBalancersInserted: lbRows,
    targetGroupsInserted: tgRows,
    listenersInserted: listenerRows,
    costRowsInserted: costRows,
    metricsRowsInserted: metricRows,
  });

  const startDate = toDateOnly(start);
  const endDate = toDateOnly(end);
  const recService = new LoadBalancerRecommendationsService();
  const recResult = await recService.refreshRecommendations({
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: null,
    dateFrom: startDate,
    dateTo: endDate,
  });

  const recommendationCount = await FactRecommendations.count({
    where: {
      sourceSystem: SOURCE_SYSTEM,
      tenantId: scope.tenantId,
      cloudConnectionId: scope.cloudConnectionId,
    } as never,
  });

  console.info("LB recommendations generated", {
    ...recResult,
    recommendationsInScope: recommendationCount,
    dateFrom: startDate,
    dateTo: endDate,
  });
}

async function main(): Promise<void> {
  const scope = await ensureCloudScope();
  console.info("Using tenant/cloud connection scope", scope);
  await seedDemoData(scope);
}

main()
  .catch((error) => {
    console.error("Load balancer demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
