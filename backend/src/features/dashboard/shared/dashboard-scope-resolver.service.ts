import { QueryTypes } from "sequelize";

import { NotFoundError } from "../../../errors/http-errors.js";
import { sequelize } from "../../../models/index.js";
import type { DashboardRequest, DashboardScope } from "../dashboard.types.js";

type IngestionRunLookupRow = {
  raw_billing_file_id: number;
  id: number;
};

type IngestionRangeRow = {
  from_date: string | null;
  to_date: string | null;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isDateOnly = (value: string | undefined): value is string =>
  typeof value === "string" && DATE_ONLY_REGEX.test(value);

export class DashboardScopeResolver {
  async resolve(input: DashboardRequest): Promise<DashboardScope> {
    if (Array.isArray(input.rawBillingFileIds) && input.rawBillingFileIds.length > 0) {
      return this.resolveUploadScope(input);
    }

    if (typeof input.rawBillingFileId === "number") {
      return this.resolveUploadScope({
        ...input,
        rawBillingFileIds: [input.rawBillingFileId],
      });
    }

    return {
      scopeType: "global",
      tenantId: input.tenantId,
      from: input.from as string,
      to: input.to as string,
      providerId: input.providerId,
      billingSourceIds:
        Array.isArray(input.billingSourceIds) && input.billingSourceIds.length > 0
          ? input.billingSourceIds
          : typeof input.billingSourceId === "number"
            ? [input.billingSourceId]
            : undefined,
      billingAccountKey: input.billingAccountKey,
      subAccountKey: input.subAccountKey,
      serviceKey: input.serviceKey,
      regionKey: input.regionKey,
    };
  }

  private async resolveUploadScope(input: DashboardRequest): Promise<DashboardScope> {
    const rawBillingFileIds = (input.rawBillingFileIds ?? []).filter((id) => Number.isInteger(id));

    const ingestionRuns = await sequelize.query<IngestionRunLookupRow>(
      `
        SELECT DISTINCT ON (birf.raw_billing_file_id)
          birf.raw_billing_file_id,
          bir.id
        FROM billing_ingestion_run_files birf
        JOIN billing_ingestion_runs bir ON bir.id = birf.ingestion_run_id
        JOIN raw_billing_files rbf ON rbf.id = birf.raw_billing_file_id
        WHERE birf.raw_billing_file_id = ANY($1::bigint[])
          AND birf.file_role = 'data'
          AND bir.status IN ('completed', 'completed_with_warnings')
          AND rbf.tenant_id = $2
        ORDER BY
          birf.raw_billing_file_id,
          bir.finished_at DESC NULLS LAST,
          bir.id DESC;
      `,
      {
        bind: [rawBillingFileIds, input.tenantId],
        type: QueryTypes.SELECT,
      },
    );

    const ingestionRunByRawFileId = new Map<number, number>();
    ingestionRuns.forEach((run) => {
      ingestionRunByRawFileId.set(Number(run.raw_billing_file_id), Number(run.id));
    });

    const missingRawFileIds = rawBillingFileIds.filter((rawFileId) => !ingestionRunByRawFileId.has(rawFileId));
    if (missingRawFileIds.length > 0) {
      throw new NotFoundError(
        `No completed or completed_with_warnings ingestion run found for rawBillingFileIds: ${missingRawFileIds.join(", ")}`,
      );
    }

    const ingestionRunIds = rawBillingFileIds.map((rawFileId) => ingestionRunByRawFileId.get(rawFileId) as number);

    const ranges = await sequelize.query<IngestionRangeRow>(
      `
        SELECT
          MIN(dd.full_date) AS from_date,
          MAX(dd.full_date) AS to_date
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE fcli.ingestion_run_id = ANY($1::bigint[]);
      `,
      {
        bind: [ingestionRunIds],
        type: QueryTypes.SELECT,
      },
    );

    const usageRange = ranges[0];
    if (!usageRange?.from_date || !usageRange?.to_date) {
      throw new NotFoundError(
        "No line-item usage dates found for the latest completed/completed_with_warnings ingestion run",
      );
    }

    const usageFrom = usageRange.from_date;
    const usageTo = usageRange.to_date;
    const requestedFrom = isDateOnly(input.from) ? input.from : undefined;
    const requestedTo = isDateOnly(input.to) ? input.to : undefined;

    let resolvedFrom = requestedFrom ?? usageFrom;
    let resolvedTo = requestedTo ?? usageTo;

    // Keep requested range inside upload usage boundaries.
    if (resolvedFrom < usageFrom) resolvedFrom = usageFrom;
    if (resolvedFrom > usageTo) resolvedFrom = usageTo;
    if (resolvedTo < usageFrom) resolvedTo = usageFrom;
    if (resolvedTo > usageTo) resolvedTo = usageTo;

    if (resolvedFrom > resolvedTo) {
      resolvedFrom = usageFrom;
      resolvedTo = usageTo;
    }

    return {
      scopeType: "upload",
      tenantId: input.tenantId,
      rawBillingFileIds,
      ingestionRunIds,
      from: resolvedFrom,
      to: resolvedTo,
    };
  }
}
