import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import {
  EC2_TRANSFER_TYPES,
  type Ec2DataTransferInput,
} from "./ec2-data-transfer.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const first = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
};

const toNullableString = (value: unknown): string | null => {
  const raw = first(value);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const schema = z.object({
  startDate: z.string().regex(DATE_ONLY_REGEX),
  endDate: z.string().regex(DATE_ONLY_REGEX),
  accountId: z.string().trim().min(1).nullable(),
  region: z.string().trim().min(1).nullable(),
  team: z.string().trim().min(1).nullable(),
  product: z.string().trim().min(1).nullable(),
  environment: z.string().trim().min(1).nullable(),
  tagKey: z.string().trim().min(1).nullable(),
  tagValue: z.string().trim().min(1).nullable(),
  transferType: z.enum(EC2_TRANSFER_TYPES).nullable(),
}).superRefine((value, ctx) => {
  if (value.startDate > value.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "startDate must be less than or equal to endDate",
    });
  }
  if (value.tagKey && !value.tagValue) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tagValue"], message: "tagValue is required when tagKey is provided" });
  }
});

export const buildEc2DataTransferInput = (req: Request, scope: DashboardScope): Ec2DataTransferInput => {
  const startDate = first(req.query.startDate) ?? first(req.query.from) ?? scope.from;
  const endDate = first(req.query.endDate) ?? first(req.query.to) ?? scope.to;
  const parsed = parseWithSchema(schema, {
    startDate,
    endDate,
    accountId: toNullableString(req.query.accountId),
    region: toNullableString(req.query.region),
    team: toNullableString(req.query.team),
    product: toNullableString(req.query.product),
    environment: toNullableString(req.query.environment),
    tagKey: toNullableString(req.query.tagKey),
    tagValue: toNullableString(req.query.tagValue),
    transferType: toNullableString(req.query.transferType),
  });

  return {
    scope,
    ...parsed,
  };
};
