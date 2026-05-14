import type { Request, Response } from "express";
import { z } from "zod";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { DbRecommendationsService } from "./db-recommendations.service.js";
import { DB_RECOMMENDATION_TYPES } from "./types/db-recommendations.types.js";

const service = new DbRecommendationsService();

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
const optionalString = (value: unknown): string | undefined => {
  const raw = firstValue(value);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const listQuerySchema = z.object({
  tenantId: z.string().trim().min(1),
  cloudConnectionId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().trim().min(1).optional(),
  recommendationType: z.enum(DB_RECOMMENDATION_TYPES).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  evidenceLevel: z.enum(["billing_only", "inventory_backed", "telemetry_backed"]).optional(),
  resourceId: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  engine: z.string().trim().min(1).optional(),
  resourceType: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: z.enum(["updated_at", "created_at", "estimated_savings"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const idParamsSchema = z.object({
  tenantId: z.string().trim().min(1),
  id: z.string().trim().min(1),
});

const generateBodySchema = z.object({
  tenantId: z.string().trim().min(1),
  cloudConnectionId: z.string().uuid().optional(),
  billingSourceId: z.coerce.number().int().positive().optional(),
});

const resolveTenantId = (req: Request): string => req.auth?.user.tenantId?.trim() ?? "";

export async function handleGetDbRecommendations(req: Request, res: Response): Promise<void> {
  const query = parseWithSchema(listQuerySchema, {
    tenantId: resolveTenantId(req),
    cloudConnectionId: optionalString(req.query.cloud_connection_id) ?? optionalString(req.query.cloudConnectionId),
    page: firstValue(req.query.page) ?? 1,
    limit: firstValue(req.query.limit) ?? firstValue(req.query.pageSize) ?? firstValue(req.query.page_size) ?? 20,
    status: optionalString(req.query.status),
    recommendationType: optionalString(req.query.recommendation_type) ?? optionalString(req.query.recommendationType),
    confidence: optionalString(req.query.confidence),
    evidenceLevel: optionalString(req.query.evidence_level) ?? optionalString(req.query.evidenceLevel),
    resourceId: optionalString(req.query.resource_id) ?? optionalString(req.query.resourceId),
    region: optionalString(req.query.region),
    engine: optionalString(req.query.engine),
    resourceType: optionalString(req.query.resource_type) ?? optionalString(req.query.resourceType),
    search: optionalString(req.query.search),
    sortBy: optionalString(req.query.sort_by) ?? optionalString(req.query.sortBy),
    sortOrder: optionalString(req.query.sort_order) ?? optionalString(req.query.sortOrder),
  });

  const data = await service.list(query);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "DB recommendations fetched", data });
}

export async function handleGetDbRecommendationsSummary(req: Request, res: Response): Promise<void> {
  const params = parseWithSchema(
    z.object({
      tenantId: z.string().trim().min(1),
      cloudConnectionId: z.string().uuid().optional(),
    }),
    {
      tenantId: resolveTenantId(req),
      cloudConnectionId: optionalString(req.query.cloud_connection_id) ?? optionalString(req.query.cloudConnectionId),
    },
  );

  const data = await service.getSummary(params);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "DB recommendations summary fetched", data });
}

export async function handleGetDbRecommendationDetail(req: Request, res: Response): Promise<void> {
  const params = parseWithSchema(idParamsSchema, {
    tenantId: resolveTenantId(req),
    id: req.params.id,
  });

  const data = await service.getById(params);
  if (!data) throw new NotFoundError("DB recommendation not found");
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "DB recommendation fetched", data });
}

export async function handleGenerateDbRecommendations(req: Request, res: Response): Promise<void> {
  const params = parseWithSchema(generateBodySchema, {
    tenantId: resolveTenantId(req),
    cloudConnectionId:
      optionalString(req.body?.cloud_connection_id) ??
      optionalString(req.body?.cloudConnectionId) ??
      optionalString(req.query.cloud_connection_id) ??
      optionalString(req.query.cloudConnectionId),
    billingSourceId: req.body?.billing_source_id ?? req.body?.billingSourceId,
  });

  const data = await service.generate(params);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "DB recommendations generation triggered", data });
}
