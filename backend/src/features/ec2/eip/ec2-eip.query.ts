import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { Ec2ElasticIpInput, Ec2ElasticIpRawRow } from "./ec2-eip.types.js";

const toScopeClauses = (input: Ec2ElasticIpInput): { whereSql: string; replacements: Record<string, unknown> } => {
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

export class Ec2ElasticIpQuery {
  async getLineItems(input: Ec2ElasticIpInput): Promise<Ec2ElasticIpRawRow[]> {
    const scoped = toScopeClauses(input);

    const rows = await sequelize.query<Ec2ElasticIpRawRow>(
      `
      SELECT
        dr.resource_id::text AS "eipId",
        NULLIF(TRIM(COALESCE(dr.resource_name, '')), '')::text AS "publicIp",
        dsa.sub_account_id::text AS "accountId",
        dsa.sub_account_name::text AS "accountName",
        COALESCE(dreg.region_id, dreg.region_name, fcli.from_region_code, fcli.to_region_code, 'unknown')::text AS region,
        fcli.usage_type AS "usageType",
        NULL::text AS "productName",
        fcli.operation AS operation,
        fcli.line_item_type AS "lineItemType",
        fcli.line_item_description AS "lineItemDescription",
        SUM(COALESCE(fcli.effective_cost, fcli.billed_cost, 0))::double precision AS cost,
        MAX(COALESCE(dd.full_date, DATE(COALESCE(fcli.usage_start_time, fcli.usage_end_time))))::text AS "usageDate"
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      LEFT JOIN dim_resource dr ON dr.id = fcli.resource_key AND dr.tenant_id = fcli.tenant_id
      LEFT JOIN dim_sub_account dsa ON dsa.id = fcli.sub_account_key
      LEFT JOIN dim_region dreg ON dreg.id = fcli.region_key
      WHERE ${scoped.whereSql}
        AND (
          LOWER(COALESCE(fcli.usage_type, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%eip%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%publicipv4%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%publicipv4%'
          OR LOWER(COALESCE(fcli.operation, '')) LIKE '%elasticip%'
          OR LOWER(COALESCE(fcli.operation, '')) LIKE '%idleaddress%'
          OR LOWER(COALESCE(fcli.operation, '')) LIKE '%publicipv4%'
          OR (
            LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) LIKE '%eip-hours%'
            OR LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) LIKE '%elastic ip%'
          )
        )
        AND LOWER(COALESCE(fcli.usage_type, '')) NOT LIKE '%datatransfer%'
        AND LOWER(COALESCE(fcli.product_usage_type, '')) NOT LIKE '%datatransfer%'
        AND LOWER(COALESCE(fcli.line_item_description, '')) NOT LIKE '%data transfer%'
        AND LOWER(COALESCE(fcli.operation, '')) NOT LIKE '%natgateway%'
        AND LOWER(COALESCE(fcli.operation, '')) NOT LIKE '%loadbalanc%'
        AND LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) NOT LIKE '%nat gateway%'
        AND LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) NOT LIKE '%elastic load balancing%'
        AND LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) NOT LIKE '%elastic block store%'
        AND LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) NOT LIKE '%snapshot%'
        AND LOWER(COALESCE(fcli.usage_type, '') || ' ' || COALESCE(fcli.product_usage_type, '') || ' ' || COALESCE(fcli.operation, '') || ' ' || COALESCE(fcli.line_item_description, '')) NOT LIKE '%boxusage%'
      GROUP BY
        dr.resource_id,
        dsa.sub_account_id,
        dsa.sub_account_name,
        COALESCE(dreg.region_id, dreg.region_name, fcli.from_region_code, fcli.to_region_code, 'unknown')::text,
        fcli.usage_type,
        fcli.operation,
        fcli.line_item_type,
        fcli.line_item_description
      ORDER BY cost DESC;
      `,
      { replacements: scoped.replacements, type: QueryTypes.SELECT },
    );

    return rows;
  }
}
