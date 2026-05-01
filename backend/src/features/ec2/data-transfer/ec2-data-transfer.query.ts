import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { Ec2DataTransferInput, Ec2DataTransferRawRow } from "./ec2-data-transfer.types.js";

const toScopeClauses = (input: Ec2DataTransferInput): { whereSql: string; replacements: Record<string, unknown> } => {
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
    if (typeof input.scope.providerId === "number") {
      where.push("fcli.provider_id = :scopeProviderId");
      replacements.scopeProviderId = input.scope.providerId;
    }
    if (Array.isArray(input.scope.billingSourceIds) && input.scope.billingSourceIds.length > 0) {
      where.push("fcli.billing_source_id IN (:scopeBillingSourceIds)");
      replacements.scopeBillingSourceIds = input.scope.billingSourceIds;
    }
    if (typeof input.scope.subAccountKey === "number") {
      where.push("fcli.sub_account_key = :scopeSubAccountKey");
      replacements.scopeSubAccountKey = input.scope.subAccountKey;
    }
    if (typeof input.scope.regionKey === "number") {
      where.push("fcli.region_key = :scopeRegionKey");
      replacements.scopeRegionKey = input.scope.regionKey;
    }
  } else if (Array.isArray(input.scope.rawBillingFileIds) && input.scope.rawBillingFileIds.length > 0) {
    where.push("fcli.billing_source_id IN (:scopeRawBillingFileIds)");
    replacements.scopeRawBillingFileIds = input.scope.rawBillingFileIds;
  }

  return { whereSql: where.join("\n        AND "), replacements };
};

export class Ec2DataTransferQuery {
  async getLineItems(input: Ec2DataTransferInput): Promise<Ec2DataTransferRawRow[]> {
    const scoped = toScopeClauses(input);
    const replacements = { ...scoped.replacements } as Record<string, unknown>;
    const tagFilterSql =
      input.tagKey && input.tagValue
        ? "AND LOWER(COALESCE(NULLIF(TRIM(lt.tags_json ->> :tagKey), ''), '')) = LOWER(:tagValue)"
        : "";
    if (input.tagKey && input.tagValue) {
      replacements.tagKey = input.tagKey;
      replacements.tagValue = input.tagValue;
    }

    const rows = await sequelize.query<Ec2DataTransferRawRow>(
      `
      WITH latest_tags AS (
        SELECT DISTINCT ON (eis.tenant_id, eis.instance_id)
          eis.tenant_id,
          eis.instance_id,
          eis.tags_json
        FROM ec2_instance_inventory_snapshots eis
        WHERE eis.tenant_id = :tenantId
          AND eis.deleted_at IS NULL
        ORDER BY eis.tenant_id, eis.instance_id, eis.is_current DESC, eis.updated_at DESC NULLS LAST
      )
      SELECT
        COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text AS date,
        dr.resource_id::text AS "resourceId",
        dr.resource_name::text AS "resourceName",
        dsa.sub_account_id::text AS "accountId",
        dsa.sub_account_name::text AS "accountName",
        COALESCE(dreg.region_id, dreg.region_name, fcli.from_region_code, fcli.to_region_code, 'unknown')::text AS region,
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'team', lt.tags_json ->> 'Team', '')), '')::text AS team,
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'product', lt.tags_json ->> 'Product', '')), '')::text AS product,
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'environment', lt.tags_json ->> 'Environment', '')), '')::text AS environment,
        fcli.usage_type AS "usageType",
        fcli.product_usage_type AS "productUsageType",
        fcli.product_family AS "productFamily",
        fcli.operation AS operation,
        fcli.line_item_description AS "lineItemDescription",
        fcli.from_location AS "fromLocation",
        fcli.to_location AS "toLocation",
        fcli.from_region_code AS "fromRegionCode",
        fcli.to_region_code AS "toRegionCode",
        SUM(COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0))::double precision AS "usageQuantity",
        SUM(
          CASE
            WHEN LOWER(COALESCE(fcli.usage_type, '')) LIKE '%byte%'
              OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%byte%'
            THEN COALESCE(fcli.consumed_quantity, fcli.pricing_quantity, 0)
            ELSE 0
          END
        )::double precision AS "usageQuantityBytes",
        SUM(COALESCE(fcli.effective_cost, fcli.billed_cost, 0))::double precision AS cost
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_resource dr ON dr.id = fcli.resource_key AND dr.tenant_id = fcli.tenant_id
      LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
      LEFT JOIN dim_region dreg ON dreg.id = fcli.region_key
      LEFT JOIN latest_tags lt ON lt.tenant_id = fcli.tenant_id AND lt.instance_id = dr.resource_id
      WHERE ${scoped.whereSql}
        ${tagFilterSql}
        AND (
          LOWER(COALESCE(fcli.usage_type, '')) LIKE '%datatransfer%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%datatransfer%'
          OR LOWER(COALESCE(fcli.product_family, '')) LIKE '%data transfer%'
          OR LOWER(COALESCE(fcli.line_item_description, '')) LIKE '%data transfer%'
          OR LOWER(COALESCE(fcli.operation, '')) LIKE '%datatransfer%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%aws-out-bytes%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%interregion%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%interzone%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%cross-az%'
        )
      GROUP BY
        COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time)))::text,
        dr.resource_id,
        dr.resource_name,
        dsa.sub_account_id,
        dsa.sub_account_name,
        COALESCE(dreg.region_id, dreg.region_name, fcli.from_region_code, fcli.to_region_code, 'unknown')::text,
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'team', lt.tags_json ->> 'Team', '')), ''),
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'product', lt.tags_json ->> 'Product', '')), ''),
        NULLIF(TRIM(COALESCE(lt.tags_json ->> 'environment', lt.tags_json ->> 'Environment', '')), ''),
        fcli.usage_type,
        fcli.product_usage_type,
        fcli.product_family,
        fcli.operation,
        fcli.line_item_description,
        fcli.from_location,
        fcli.to_location,
        fcli.from_region_code,
        fcli.to_region_code
      ORDER BY 1 ASC;
      `,
      { replacements, type: QueryTypes.SELECT },
    );

    return rows;
  }
}
