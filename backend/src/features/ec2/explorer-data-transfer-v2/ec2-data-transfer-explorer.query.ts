import { QueryTypes } from "sequelize";
import { sequelize } from "../../../models/index.js";
import { classifyDataTransferSignals } from "../classification/data-transfer-classifier.js";
import type { Ec2DataTransferExplorerInput, Ec2DataTransferExplorerRawRow } from "./ec2-data-transfer-explorer.types.js";

type CurTransferRawRow = {
  date: string;
  account: string | null;
  region: string | null;
  instanceType: string | null;
  instanceId: string | null;
  instanceName: string | null;
  tagsJson: Record<string, unknown> | null;
  usageType: string | null;
  productUsageType: string | null;
  operation: string | null;
  productFamily: string | null;
  lineItemType: string | null;
  lineItemDescription: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
  serviceName: string | null;
  pricingUnit: string | null;
  billedCost: number | string | null;
  effectiveCost: number | string | null;
  usageQuantity: number | string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const normalizeTag = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const includesAny = (text: string, tokens: string[]): boolean => tokens.some((token) => text.includes(token));

const isEc2Service = (serviceName: string | null): boolean => {
  const normalized = normalize(serviceName);
  return includesAny(normalized, [
    "amazon elastic compute cloud",
    "ec2",
    "ec2-other",
    "ec2 other",
  ]);
};

const isTransferKeywordMatch = (input: {
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  lineItemDescription: string | null;
}): boolean => {
  const blob = [
    normalize(input.usageType),
    normalize(input.productUsageType),
    normalize(input.productFamily),
    normalize(input.lineItemDescription),
  ].join(" ");
  return includesAny(blob, [
    "datatransfer",
    "data transfer",
    "bytes",
    "regional",
    "out",
    "in",
  ]);
};

const isExcludedNonEc2NetworkLine = (input: {
  usageType: string | null;
  productUsageType: string | null;
  operation: string | null;
  productFamily: string | null;
  lineItemDescription: string | null;
  serviceName: string | null;
}): boolean => {
  const blob = [
    normalize(input.usageType),
    normalize(input.productUsageType),
    normalize(input.operation),
    normalize(input.productFamily),
    normalize(input.lineItemDescription),
    normalize(input.serviceName),
  ].join(" ");
  return includesAny(blob, [
    "natgateway",
    "nat-gateway",
    "nat gateway",
    "dataprocessing-bytes",
    "loadbalancer",
    "load balancer",
    "elasticloadbalancing",
    "lcu",
    "cloudfront",
    "vpc endpoint",
    "vpce",
    "transitgateway",
    "transit gateway",
  ]);
};

const isGbUnit = (pricingUnit: string | null): boolean => {
  const unit = normalize(pricingUnit);
  return unit === "gb" || unit === "gibibyte" || unit === "gibibytes";
};

export class Ec2DataTransferExplorerQuery {
  async getRows(input: Ec2DataTransferExplorerInput): Promise<Ec2DataTransferExplorerRawRow[]> {
    const replacements: Record<string, unknown> = {
      tenantId: input.scope.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
    };
    const where: string[] = [
      "fcli.tenant_id = :tenantId",
      "COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time))) BETWEEN :startDate::date AND :endDate::date",
    ];

    if (input.scope.scopeType === "global") {
      if (typeof input.scope.providerId === "number") {
        where.push("fcli.provider_id = :providerId");
        replacements.providerId = input.scope.providerId;
      }
      if (Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0) {
        where.push("fcli.billing_source_id IN (:billingSourceIds)");
        replacements.billingSourceIds = input.scope.billingSourceIds;
      }
      if (typeof input.scope.subAccountKey === "number") {
        where.push("fcli.sub_account_key = :subAccountKey");
        replacements.subAccountKey = input.scope.subAccountKey;
      }
      if (typeof input.scope.regionKey === "number") {
        where.push("fcli.region_key = :regionKey");
        replacements.regionKey = input.scope.regionKey;
      }
    } else if (Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0) {
      where.push("fcli.billing_source_id IN (:scopeRawBillingFileIds)");
      replacements.scopeRawBillingFileIds = input.scope.rawBillingFileIds;
    }

    const rawRows = await sequelize.query<CurTransferRawRow>(
      `
      WITH latest_instance AS (
        SELECT DISTINCT ON (i.tenant_id, i.instance_id)
          i.tenant_id,
          i.instance_id,
          i.instance_type,
          i.tags_json
        FROM ec2_instance_inventory_snapshots i
        WHERE i.tenant_id = :tenantId
          AND i.deleted_at IS NULL
        ORDER BY i.tenant_id, i.instance_id, i.is_current DESC, i.discovered_at DESC NULLS LAST, i.updated_at DESC NULLS LAST
      )
      SELECT
        COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
        COALESCE(dsa.sub_account_id::text, dsa.sub_account_name, 'Unknown')::text AS account,
        COALESCE(dreg.region_id, dreg.region_name, 'Unknown')::text AS region,
        COALESCE(NULLIF(TRIM(li.instance_type), ''), NULLIF(TRIM(fcli.usage_type), ''), 'Unknown')::text AS "instanceType",
        COALESCE(NULLIF(TRIM(dr.resource_id), ''), NULLIF(TRIM(li.instance_id), ''), 'unknown')::text AS "instanceId",
        COALESCE(
          NULLIF(TRIM(li.tags_json ->> 'Name'), ''),
          NULLIF(TRIM(li.tags_json ->> 'name'), ''),
          NULLIF(TRIM(dr.resource_name), ''),
          NULLIF(TRIM(dr.resource_id), ''),
          'Unknown'
        )::text AS "instanceName",
        li.tags_json AS "tagsJson",
        fcli.usage_type AS "usageType",
        fcli.product_usage_type AS "productUsageType",
        fcli.operation AS operation,
        fcli.product_family AS "productFamily",
        fcli.line_item_type AS "lineItemType",
        fcli.line_item_description AS "lineItemDescription",
        fcli.from_location AS "fromLocation",
        fcli.to_location AS "toLocation",
        fcli.from_region_code AS "fromRegionCode",
        fcli.to_region_code AS "toRegionCode",
        ds.service_name AS "serviceName",
        dsku.pricing_unit AS "pricingUnit",
        SUM(COALESCE(fcli.billed_cost, 0))::double precision AS "billedCost",
        SUM(COALESCE(fcli.effective_cost, fcli.billed_cost, 0))::double precision AS "effectiveCost",
        SUM(COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0))::double precision AS "usageQuantity"
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_sku dsku ON dsku.id = fcli.sku_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
      LEFT JOIN dim_region dreg ON dreg.id = fcli.region_key
      LEFT JOIN dim_resource dr ON dr.id = fcli.resource_key AND dr.tenant_id = fcli.tenant_id
      LEFT JOIN latest_instance li
        ON li.tenant_id = fcli.tenant_id
       AND li.instance_id = NULLIF(TRIM(dr.resource_id), '')
      WHERE ${where.join("\n        AND ")}
      GROUP BY
        COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
        COALESCE(dsa.sub_account_id::text, dsa.sub_account_name, 'Unknown')::text,
        COALESCE(dreg.region_id, dreg.region_name, 'Unknown')::text,
        COALESCE(NULLIF(TRIM(li.instance_type), ''), NULLIF(TRIM(fcli.usage_type), ''), 'Unknown')::text,
        COALESCE(NULLIF(TRIM(dr.resource_id), ''), NULLIF(TRIM(li.instance_id), ''), 'unknown')::text,
        COALESCE(
          NULLIF(TRIM(li.tags_json ->> 'Name'), ''),
          NULLIF(TRIM(li.tags_json ->> 'name'), ''),
          NULLIF(TRIM(dr.resource_name), ''),
          NULLIF(TRIM(dr.resource_id), ''),
          'Unknown'
        )::text,
        li.tags_json,
        fcli.usage_type,
        fcli.product_usage_type,
        fcli.operation,
        fcli.product_family,
        fcli.line_item_type,
        fcli.line_item_description,
        fcli.from_location,
        fcli.to_location,
        fcli.from_region_code,
        fcli.to_region_code,
        ds.service_name,
        dsku.pricing_unit
      ORDER BY 1 ASC;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    const excludedInfraRows = rawRows.filter((row) => isExcludedNonEc2NetworkLine(row));
    const ec2Rows = rawRows.filter((row) => isEc2Service(row.serviceName));
    const transferKeywordRows = ec2Rows.filter((row) => isTransferKeywordMatch(row));
    const nonInfraRows = transferKeywordRows.filter((row) => !isExcludedNonEc2NetworkLine(row));
    const classifiedRows = nonInfraRows.map((row) => {
      const classification = classifyDataTransferSignals({
        usageType: row.usageType,
        productUsageType: row.productUsageType,
        productFamily: row.productFamily,
        operation: row.operation,
        lineItemDescription: row.lineItemDescription,
        fromLocation: row.fromLocation,
        toLocation: row.toLocation,
        fromRegionCode: row.fromRegionCode,
        toRegionCode: row.toRegionCode,
      });
      return { row, classification };
    });
    const candidateRows = classifiedRows.filter(({ classification }) => classification.isDataTransferCandidate && !classification.isNatGateway);
    const rows = candidateRows
      .filter(({ classification }) => {
        if (input.filters.transferTypes.length === 0) return true;
        return input.filters.transferTypes.includes(classification.transferType);
      })
      .filter(({ row }) => {
        if (input.filters.accountIds.length === 0) return true;
        return input.filters.accountIds.map((value) => value.toLowerCase()).includes(String(row.account ?? "").toLowerCase());
      })
      .filter(({ row }) => {
        if (input.filters.regions.length === 0) return true;
        return input.filters.regions.map((value) => value.toLowerCase()).includes(String(row.region ?? "").toLowerCase());
      })
      .filter(({ row }) => {
        if (input.filters.instanceTypes.length === 0) return true;
        return input.filters.instanceTypes.map((value) => value.toLowerCase()).includes(String(row.instanceType ?? "").toLowerCase());
      })
      .filter(({ row }) => {
        if (input.filters.tags.length === 0) return true;
        const tagMap = (row.tagsJson ?? {}) as Record<string, unknown>;
        return input.filters.tags.every((tag) => {
          const found = Object.entries(tagMap).find(([k]) => normalizeTag(k) === normalizeTag(tag.key));
          return found ? normalizeTag(found[1]) === normalizeTag(tag.value) : false;
        });
      })
      .map(({ row, classification }) => {
        const transferType = classification.transferType;
        const billedCost = Math.max(0, toNumber(row.billedCost));
        const effectiveCost = Math.max(0, toNumber(row.effectiveCost));
        const resolvedTransferCost = billedCost > 0 ? billedCost : effectiveCost;
        const usageGb = isGbUnit(row.pricingUnit) ? Math.max(0, toNumber(row.usageQuantity)) : 0;
        return {
          date: row.date,
          account: String(row.account ?? "Unknown"),
          region: String(row.region ?? "Unknown"),
          instanceType: String(row.instanceType ?? "Unknown"),
          instanceId: String(row.instanceId ?? "unknown"),
          instanceName: String(row.instanceName ?? row.instanceId ?? "Unknown"),
          tagsJson: row.tagsJson,
          transferType,
          cost: resolvedTransferCost,
          usageGb,
          internetCost: transferType === "internet" ? resolvedTransferCost : 0,
          interRegionCost: transferType === "inter_region" ? resolvedTransferCost : 0,
          interAzCost: transferType === "inter_az" ? resolvedTransferCost : 0,
          regionalCost: transferType === "regional" ? resolvedTransferCost : 0,
          unknownCost: transferType === "unknown" ? resolvedTransferCost : 0,
        } satisfies Ec2DataTransferExplorerRawRow;
      });

    const byType = new Map<string, { usageGb: number; billedCost: number; effectiveCost: number; matchedRows: number }>();
    for (const item of candidateRows) {
      const key = item.classification.transferType;
      const current = byType.get(key) ?? { usageGb: 0, billedCost: 0, effectiveCost: 0, matchedRows: 0 };
      const billedCost = Math.max(0, toNumber(item.row.billedCost));
      const effectiveCost = Math.max(0, toNumber(item.row.effectiveCost));
      const usageGb = isGbUnit(item.row.pricingUnit) ? Math.max(0, toNumber(item.row.usageQuantity)) : 0;
      current.billedCost += billedCost;
      current.effectiveCost += effectiveCost;
      current.usageGb += usageGb;
      current.matchedRows += 1;
      byType.set(key, current);
    }
    const byTypeObj = Object.fromEntries(
      [...byType.entries()].map(([key, value]) => [
        key,
        {
          usageGb: Number(value.usageGb.toFixed(4)),
          billedCost: Number(value.billedCost.toFixed(4)),
          effectiveCost: Number(value.effectiveCost.toFixed(4)),
          matchedRows: value.matchedRows,
        },
      ]),
    );
    const excludedInfraCost = excludedInfraRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.billedCost)), 0);
    console.debug("[EC2 Data Transfer Explorer V2][CUR Diagnostics]", {
      totals: {
        rawRows: rawRows.length,
        ec2Rows: ec2Rows.length,
        transferKeywordRows: transferKeywordRows.length,
        nonInfraRows: nonInfraRows.length,
        classifiedRows: classifiedRows.length,
        transferCandidateRows: candidateRows.length,
        finalRows: rows.length,
      },
      filteredRows: {
        excludedNonEc2InfraRows: excludedInfraRows.length,
        excludedNonEc2InfraCost: Number(excludedInfraCost.toFixed(4)),
        removedByScopeFilters: candidateRows.length - rows.length,
      },
      transferCategories: byTypeObj,
    });

    return rows;
  }
}
