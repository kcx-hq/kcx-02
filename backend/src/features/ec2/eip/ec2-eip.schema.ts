import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DashboardScope } from "../../dashboard/dashboard.types.js";
import { EC2_EIP_STATES, type Ec2ElasticIpInput } from "./ec2-eip.types.js";

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
  state: z.enum(EC2_EIP_STATES),
  search: z.string().trim().min(1).nullable(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(200),
}).superRefine((value, ctx) => {
  if (value.startDate > value.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "startDate must be less than or equal to endDate",
    });
  }
});

export const buildEc2ElasticIpInput = (req: Request, scope: DashboardScope): Ec2ElasticIpInput => {
  const parsed = parseWithSchema(schema, {
    startDate: first(req.query.startDate) ?? first(req.query.from) ?? scope.from,
    endDate: first(req.query.endDate) ?? first(req.query.to) ?? scope.to,
    accountId: toNullableString(req.query.accountId),
    region: toNullableString(req.query.region),
    state: first(req.query.state) ?? "all",
    search: toNullableString(req.query.search),
    page: Number(first(req.query.page) ?? "1"),
    pageSize: Number(first(req.query.pageSize) ?? "25"),
  });

  return {
    scope,
    ...parsed,
  };
};
