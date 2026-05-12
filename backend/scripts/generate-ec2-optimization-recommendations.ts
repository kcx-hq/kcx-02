// @ts-nocheck
import { Ec2RecommendationsService } from "../src/features/ec2/optimization/ec2-recommendations.service.js";
import { BillingSource, CloudProvider, sequelize } from "../src/models/index.js";

type CliOptions = {
  tenantId?: string;
  billingSourceId?: string;
  cloudConnectionId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (const rawArg of argv.slice(2)) {
    const arg = String(rawArg ?? "").trim();
    if (!arg) continue;
    const [key, ...rest] = arg.split("=");
    const value = rest.join("=").trim();
    if (!value) continue;

    if (key === "--tenant-id") options.tenantId = value;
    if (key === "--billing-source-id") options.billingSourceId = value;
    if (key === "--cloud-connection-id") options.cloudConnectionId = value;
    if (key === "--date-from") options.dateFrom = value;
    if (key === "--date-to") options.dateTo = value;
  }
  return options;
}

function resolveDateRange(input: CliOptions): { dateFrom: string; dateTo: string } {
  if (input.dateFrom || input.dateTo) {
    if (!input.dateFrom || !input.dateTo) {
      throw new Error("Provide both --date-from and --date-to together");
    }
    if (!DATE_ONLY_REGEX.test(input.dateFrom) || !DATE_ONLY_REGEX.test(input.dateTo)) {
      throw new Error("--date-from and --date-to must be YYYY-MM-DD");
    }
    if (input.dateFrom > input.dateTo) {
      throw new Error("--date-from must be <= --date-to");
    }
    return { dateFrom: input.dateFrom, dateTo: input.dateTo };
  }

  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 29);
  return { dateFrom: toDateOnly(start), dateTo: toDateOnly(end) };
}

async function resolveScopes(options: CliOptions): Promise<Array<{ tenantId: string; billingSourceId: number; cloudConnectionId: string }>> {
  if (options.tenantId && options.billingSourceId && options.cloudConnectionId) {
    return [{
      tenantId: options.tenantId,
      billingSourceId: Number(options.billingSourceId),
      cloudConnectionId: options.cloudConnectionId,
    }];
  }

  const awsProvider = await CloudProvider.findOne({ where: { code: "aws" } });
  if (!awsProvider) return [];

  const where: Record<string, unknown> = {
    cloudProviderId: String(awsProvider.id),
    status: "active",
  };
  if (options.tenantId) where.tenantId = options.tenantId;
  if (options.billingSourceId) where.id = options.billingSourceId;
  if (options.cloudConnectionId) where.cloudConnectionId = options.cloudConnectionId;

  const sources = await BillingSource.findAll({ where, order: [["updatedAt", "DESC"]] });

  return sources
    .map((source) => ({
      tenantId: String(source.tenantId ?? "").trim(),
      billingSourceId: Number(source.id),
      cloudConnectionId: String(source.cloudConnectionId ?? "").trim(),
    }))
    .filter((scope) => Boolean(scope.tenantId && Number.isFinite(scope.billingSourceId) && scope.cloudConnectionId));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const { dateFrom, dateTo } = resolveDateRange(options);
  const scopes = await resolveScopes(options);

  if (scopes.length === 0) {
    console.info("No eligible AWS billing scopes found for EC2 recommendation refresh.");
    return;
  }

  const service = new Ec2RecommendationsService();
  const summary = {
    attemptedScopes: 0,
    success: 0,
    failed: 0,
    created: 0,
    updated: 0,
    resolved: 0,
  };
  const details: Array<Record<string, unknown>> = [];

  for (const scope of scopes) {
    summary.attemptedScopes += 1;
    try {
      const result = await service.refreshRecommendations({
        tenantId: scope.tenantId,
        billingSourceId: scope.billingSourceId,
        cloudConnectionId: scope.cloudConnectionId,
        dateFrom,
        dateTo,
      });

      summary.success += 1;
      summary.created += result.created;
      summary.updated += result.updated;
      summary.resolved += result.resolved;

      details.push({
        tenantId: scope.tenantId,
        billingSourceId: scope.billingSourceId,
        cloudConnectionId: scope.cloudConnectionId,
        dateFrom,
        dateTo,
        ...result,
      });
    } catch (error) {
      summary.failed += 1;
      details.push({
        tenantId: scope.tenantId,
        billingSourceId: scope.billingSourceId,
        cloudConnectionId: scope.cloudConnectionId,
        dateFrom,
        dateTo,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("EC2 category recommendation refresh completed", summary);
  console.info("EC2 category recommendation refresh details", details);
}

main()
  .catch((error) => {
    console.error("EC2 category recommendation refresh failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
