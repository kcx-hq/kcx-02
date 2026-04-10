import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format");

const anomalyCreateJobSchema = z
  .object({
    mode: z.enum(["incremental", "date_range", "full"]),
    billing_source_id: z.coerce.number().int().positive().optional(),
    tenant_id: z.string().trim().uuid().optional(),
    date_from: dateOnlySchema.optional(),
    date_to: dateOnlySchema.optional(),
    include_hourly: z.boolean().optional().default(false),
    force_rebuild: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const hasBillingSource = typeof value.billing_source_id === "number";

    if (!hasBillingSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billing_source_id"],
        message: "billing_source_id is required",
      });
    }

    if (value.tenant_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tenant_id"],
        message: "tenant_id-only manual jobs are not supported yet; use billing_source_id",
      });
    }

    if (value.mode === "date_range") {
      if (!value.date_from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_from"],
          message: "date_from is required for date_range mode",
        });
      }
      if (!value.date_to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date_to"],
          message: "date_to is required for date_range mode",
        });
      }
    }

    if (value.mode === "incremental" && value.date_to && !value.date_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_from"],
        message: "date_from is required when date_to is provided",
      });
    }

    if (value.date_from && value.date_to && value.date_from > value.date_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_from"],
        message: "date_from must be less than or equal to date_to",
      });
    }
  });

const anomalyJobIdParamsSchema = z.object({
  jobId: z.string().uuid("jobId must be a valid UUID"),
});

const anomalyListQuerySchema = z
  .object({
    billing_source_id: z.coerce.number().int().positive().optional(),
    status: z.enum(["open", "resolved", "ignored"]).optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
    anomaly_type: z.string().trim().min(1).optional(),
    date_from: dateOnlySchema.optional(),
    date_to: dateOnlySchema.optional(),
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
  })
  .superRefine((value, ctx) => {
    if (value.date_from && value.date_to && value.date_from > value.date_to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_from"],
        message: "date_from must be less than or equal to date_to",
      });
    }
  });

export type CreateAnomalyJobPayload = z.output<typeof anomalyCreateJobSchema>;
export type AnomalyListQuery = z.output<typeof anomalyListQuerySchema>;

export function parseCreateAnomalyJobPayload(value: unknown): CreateAnomalyJobPayload {
  return parseWithSchema(anomalyCreateJobSchema, value);
}

export function parseAnomalyJobIdParams(value: unknown): { jobId: string } {
  return parseWithSchema(anomalyJobIdParamsSchema, value);
}

export function parseAnomalyListQuery(value: unknown): AnomalyListQuery {
  return parseWithSchema(anomalyListQuerySchema, value);
}
