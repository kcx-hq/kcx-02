import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { Ec2ElasticIpInput, Ec2ElasticIpRawRow } from "./ec2-eip.types.js";

const toScopeClauses = (
  input: Ec2ElasticIpInput,
  options?: {
    hasProviderId?: boolean;
    hasBillingSourceId?: boolean;
    hasSubAccountKey?: boolean;
    hasRegionKey?: boolean;
    hasIngestionRunId?: boolean;
  },
): { whereSql: string; replacements: Record<string, unknown> } => {
  const where: string[] = [
    "fcli.tenant_id = :tenantId",
    "COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time))) BETWEEN :startDate::date AND :endDate::date",
  ];
  const replacements: Record<string, unknown> = {
    tenantId: input.scope.tenantId,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  if (input.scope.scopeType === "global") {
    if (options?.hasProviderId !== false && typeof input.scope.providerId === "number") {
      where.push("fcli.provider_id = :scopeProviderId");
      replacements.scopeProviderId = input.scope.providerId;
    }
    if (
      options?.hasBillingSourceId !== false &&
      Array.isArray(input.scope.billingSourceIds) &&
      input.scope.billingSourceIds.length > 0
    ) {
      where.push("fcli.billing_source_id IN (:scopeBillingSourceIds)");
      replacements.scopeBillingSourceIds = input.scope.billingSourceIds;
    }
    if (options?.hasSubAccountKey !== false && typeof input.scope.subAccountKey === "number") {
      where.push("fcli.sub_account_key = :scopeSubAccountKey");
      replacements.scopeSubAccountKey = input.scope.subAccountKey;
    }
    if (options?.hasRegionKey !== false && typeof input.scope.regionKey === "number") {
      where.push("fcli.region_key = :scopeRegionKey");
      replacements.scopeRegionKey = input.scope.regionKey;
    }
  } else if (
    options?.hasIngestionRunId !== false &&
    Array.isArray(input.scope.ingestionRunIds) &&
    input.scope.ingestionRunIds.length > 0
  ) {
    where.push("fcli.ingestion_run_id IN (:scopeIngestionRunIds)");
    replacements.scopeIngestionRunIds = input.scope.ingestionRunIds;
  }

  return { whereSql: where.join("\n        AND "), replacements };
};

export class Ec2ElasticIpQuery {
  private hasCheckedColumns = false;
  private availableColumns = new Set<string>();

  private async ensureFactColumnsLoaded(): Promise<void> {
    if (this.hasCheckedColumns) return;
    const rows = await sequelize.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'fact_cost_line_items';
      `,
      { type: QueryTypes.SELECT },
    );
    this.availableColumns = new Set(rows.map((row) => row.column_name));
    this.hasCheckedColumns = true;
  }

  private hasFactColumn(columnName: string): boolean {
    return this.availableColumns.has(columnName);
  }

  async getLineItems(input: Ec2ElasticIpInput): Promise<Ec2ElasticIpRawRow[]> {
    await this.ensureFactColumnsLoaded();
    const hasProviderId = this.hasFactColumn("provider_id");
    const hasBillingSourceId = this.hasFactColumn("billing_source_id");
    const hasSubAccountKey = this.hasFactColumn("sub_account_key");
    const hasRegionKey = this.hasFactColumn("region_key");
    const hasIngestionRunId = this.hasFactColumn("ingestion_run_id");
    const hasUsageDateKey = this.hasFactColumn("usage_date_key");
    const hasResourceKey = this.hasFactColumn("resource_key");
    const hasUsageStartTime = this.hasFactColumn("usage_start_time");
    const hasUsageEndTime = this.hasFactColumn("usage_end_time");
    const hasEffectiveCost = this.hasFactColumn("effective_cost");
    const hasBilledCost = this.hasFactColumn("billed_cost");
    const hasOperation = this.hasFactColumn("operation");
    const hasUsageType = this.hasFactColumn("usage_type");

    const scoped = toScopeClauses(input, {
      hasProviderId,
      hasBillingSourceId,
      hasSubAccountKey,
      hasRegionKey,
      hasIngestionRunId,
    });
    const hasProductUsageType = this.hasFactColumn("product_usage_type");
    const hasLineItemDescription = this.hasFactColumn("line_item_description");
    const hasLineItemType = this.hasFactColumn("line_item_type");
    const hasFromRegionCode = this.hasFactColumn("from_region_code");
    const hasToRegionCode = this.hasFactColumn("to_region_code");

    const productUsageTypeExpr = hasProductUsageType ? "fcli.product_usage_type" : "NULL::text";
    const lineItemDescriptionExpr = hasLineItemDescription ? "fcli.line_item_description" : "NULL::text";
    const lineItemTypeExpr = hasLineItemType ? "fcli.line_item_type" : "NULL::text";
    const fromRegionExpr = hasFromRegionCode ? "fcli.from_region_code::text" : "NULL::text";
    const toRegionExpr = hasToRegionCode ? "fcli.to_region_code::text" : "NULL::text";
    const usageDateExpr = hasUsageDateKey
      ? "COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))"
      : hasUsageStartTime && hasUsageEndTime
        ? "DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time))"
        : hasUsageStartTime
          ? "DATE(fcli.usage_start_time)"
          : hasUsageEndTime
            ? "DATE(fcli.usage_end_time)"
            : "NULL::date";
    const effectiveCostExpr = hasEffectiveCost ? "fcli.effective_cost" : "NULL::numeric";
    const billedCostExpr = hasBilledCost ? "fcli.billed_cost" : "NULL::numeric";
    const operationExpr = hasOperation ? "fcli.operation" : "NULL::text";
    const usageTypeExpr = hasUsageType ? "fcli.usage_type" : "NULL::text";
    const joinDateSql = hasUsageDateKey ? "LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key" : "LEFT JOIN dim_date dd ON FALSE";
    const joinResourceSql = hasResourceKey
      ? "LEFT JOIN dim_resource dr ON dr.id = fcli.resource_key AND dr.tenant_id = fcli.tenant_id"
      : "LEFT JOIN dim_resource dr ON FALSE";
    const joinSubAccountSql = hasSubAccountKey
      ? "LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key"
      : "LEFT JOIN dim_sub_account dsa ON FALSE";
    const joinRegionSql = hasRegionKey
      ? "LEFT JOIN dim_region dreg ON dreg.id = fcli.region_key"
      : "LEFT JOIN dim_region dreg ON FALSE";

    const rows = await sequelize.query<Ec2ElasticIpRawRow>(
      `
      SELECT
        dr.resource_id::text AS "eipId",
        NULLIF(TRIM(COALESCE(dr.resource_name, '')), '')::text AS "publicIp",
        dsa.sub_account_id::text AS "accountId",
        dsa.sub_account_name::text AS "accountName",
        COALESCE(
          dreg.region_id::text,
          dreg.region_name::text,
          ${fromRegionExpr},
          ${toRegionExpr},
          'unknown'
        ) AS region,
        ${usageTypeExpr} AS "usageType",
        NULL::text AS "productName",
        ${operationExpr} AS operation,
        ${lineItemTypeExpr} AS "lineItemType",
        ${lineItemDescriptionExpr} AS "lineItemDescription",
        SUM(COALESCE(${effectiveCostExpr}, ${billedCostExpr}, 0))::double precision AS cost,
        MAX(${usageDateExpr})::text AS "usageDate"
      FROM fact_cost_line_items fcli
      ${joinDateSql}
      ${joinResourceSql}
      ${joinSubAccountSql}
      ${joinRegionSql}
      WHERE ${scoped.whereSql}
        AND (
          LOWER(COALESCE(${usageTypeExpr}, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(${usageTypeExpr}, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(${usageTypeExpr}, '')) LIKE '%eip%'
          OR LOWER(COALESCE(${usageTypeExpr}, '')) LIKE '%publicipv4%'
          OR LOWER(COALESCE(${productUsageTypeExpr}, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(${productUsageTypeExpr}, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(${productUsageTypeExpr}, '')) LIKE '%publicipv4%'
          OR LOWER(COALESCE(${operationExpr}, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(${operationExpr}, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(${operationExpr}, '')) LIKE '%publicipv4%'
          OR (
            LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) LIKE '%eip-hours%'
            OR LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) LIKE '%elastic ip%'
          )
        )
        AND LOWER(COALESCE(${usageTypeExpr}, '')) NOT LIKE '%datatransfer%'
        AND LOWER(COALESCE(${productUsageTypeExpr}, '')) NOT LIKE '%datatransfer%'
        AND LOWER(COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%data transfer%'
        AND LOWER(COALESCE(${operationExpr}, '')) NOT LIKE '%natgateway%'
        AND LOWER(COALESCE(${operationExpr}, '')) NOT LIKE '%loadbalanc%'
        AND LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%nat gateway%'
        AND LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%elastic load balancing%'
        AND LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%elastic block store%'
        AND LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%snapshot%'
        AND LOWER(COALESCE(${usageTypeExpr}, '') || ' ' || COALESCE(${productUsageTypeExpr}, '') || ' ' || COALESCE(${operationExpr}, '') || ' ' || COALESCE(${lineItemDescriptionExpr}, '')) NOT LIKE '%boxusage%'
      GROUP BY
        dr.resource_id,
        dsa.sub_account_id,
        dsa.sub_account_name,
        COALESCE(
          dreg.region_id::text,
          dreg.region_name::text,
          ${fromRegionExpr},
          ${toRegionExpr},
          'unknown'
        ),
        ${usageTypeExpr},
        ${operationExpr},
        ${lineItemTypeExpr},
        ${lineItemDescriptionExpr}
      ORDER BY cost DESC;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    return rows;
  }
}
