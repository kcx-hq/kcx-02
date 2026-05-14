import { Op, QueryTypes } from "sequelize";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { DbRecommendationsGenerator } from "./db-recommendations.generator.js";
import type {
  DbRecommendationDetail,
  DbRecommendationListItem,
  DbRecommendationsGenerateInput,
  DbRecommendationsGenerateResult,
  DbRecommendationsListQuery,
  DbRecommendationSummary,
} from "./types/db-recommendations.types.js";
import {
  asStringArray,
  getMetadataConfidence,
  getMetadataEngine,
  getMetadataEstimatedMonthlySavings,
  getMetadataEvidenceLevel,
  getMetadataRegion,
  getMetadataResourceType,
  getMetadataSavingsBasis,
  parseMetadataWarnings,
  parseRecommendationMetadata,
  parseSignalsMissing,
  parseSignalsUsed,
} from "./utils/db-recommendation-metadata.js";

const DB_CATEGORY = "DB";
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY = "updated_at";
const DEFAULT_SORT_ORDER = "desc";

const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "SNOOZED"];

const toNumber = (value: unknown): number => Number(value ?? 0);
const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeText = (value: string | null | undefined): string => (value ?? "").toLowerCase();

const mapListItem = (row: any): DbRecommendationListItem => {
  const metadata = parseRecommendationMetadata(row.metadataJson);
  const warnings = parseMetadataWarnings(metadata?.data_quality_warnings);
  const sourceTables = asStringArray(metadata?.source_tables);

  return {
    id: String(row.id),
    category: row.category,
    recommendation_type: row.recommendationType,
    title: row.recommendationTitle ?? null,
    description: row.recommendationText ?? null,
    status: row.status,
    severity: row.riskLevel ?? null,
    priority: row.effortLevel ?? null,
    estimated_savings: toNumber(row.estimatedMonthlySavings),
    estimated_monthly_savings: getMetadataEstimatedMonthlySavings(metadata),
    resource_id: row.resourceId ?? null,
    cloud_connection_id: row.cloudConnectionId ?? null,
    confidence: getMetadataConfidence(metadata),
    confidence_score: typeof metadata?.confidence_score === "number" ? metadata.confidence_score : null,
    evidence_level: getMetadataEvidenceLevel(metadata),
    savings_basis: getMetadataSavingsBasis(metadata),
    warnings_count: warnings.length,
    source_tables: sourceTables,
    updated_at: toIso(row.updatedAt),
    created_at: toIso(row.createdAt),
  };
};

const matchesSearch = (row: any, search: string | undefined): boolean => {
  if (!search) return true;
  const needle = search.toLowerCase();
  const metadata = parseRecommendationMetadata(row.metadataJson);
  const engine = getMetadataEngine(metadata);
  const haystack = [
    row.recommendationTitle,
    row.recommendationText,
    row.resourceId,
    row.recommendationType,
    row.resourceName,
    row.resourceType,
    engine,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
};

const matchesMetadataFilters = (row: any, query: DbRecommendationsListQuery): boolean => {
  const metadata = parseRecommendationMetadata(row.metadataJson);

  if (query.confidence && getMetadataConfidence(metadata) !== query.confidence) return false;
  if (query.evidenceLevel && getMetadataEvidenceLevel(metadata) !== query.evidenceLevel) return false;

  const region = row.awsRegionCode ?? getMetadataRegion(metadata);
  if (query.region && normalizeText(region) !== normalizeText(query.region)) return false;

  const resourceType = row.resourceType ?? getMetadataResourceType(metadata);
  if (query.resourceType && normalizeText(resourceType) !== normalizeText(query.resourceType)) return false;

  const engine = getMetadataEngine(metadata);
  if (query.engine && normalizeText(engine) !== normalizeText(query.engine)) return false;

  return true;
};

export class DbRecommendationsService {
  constructor(private readonly generator: DbRecommendationsGenerator = new DbRecommendationsGenerator()) {}

  async list(query: DbRecommendationsListQuery): Promise<{
    items: DbRecommendationListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    filterOptions: {
      statuses: string[];
      recommendationTypes: string[];
      confidences: string[];
      evidenceLevels: string[];
      engines: string[];
      resourceTypes: string[];
      regions: string[];
    };
  }> {
    const where: Record<string, unknown> = {
      tenantId: query.tenantId,
      category: DB_CATEGORY,
    };

    if (query.cloudConnectionId) where.cloudConnectionId = query.cloudConnectionId;
    if (query.status) where.status = String(query.status).toUpperCase();
    else where.status = { [Op.in]: ACTIVE_STATUSES };
    if (query.recommendationType) where.recommendationType = query.recommendationType;
    if (query.resourceId) where.resourceId = { [Op.iLike]: `%${query.resourceId}%` };

    const sortColumn =
      query.sortBy === "created_at"
        ? "createdAt"
        : query.sortBy === "estimated_savings"
          ? "estimatedMonthlySavings"
          : "updatedAt";

    const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

    const rawRows = await FactRecommendations.findAll({
      where,
      order: [[sortColumn, sortOrder], ["updatedAt", "DESC"]],
    });

    const filtered = rawRows.filter((row) => matchesSearch(row, query.search) && matchesMetadataFilters(row, query));

    const page = query.page;
    const limit = query.limit;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    const filterOptions = {
      statuses: [...new Set(filtered.map((row) => String(row.status)).filter(Boolean))].sort(),
      recommendationTypes: [...new Set(filtered.map((row) => String(row.recommendationType)).filter(Boolean))].sort(),
      confidences: [...new Set(filtered.map((row) => getMetadataConfidence(parseRecommendationMetadata(row.metadataJson))).filter(Boolean))] as string[],
      evidenceLevels: [...new Set(filtered.map((row) => getMetadataEvidenceLevel(parseRecommendationMetadata(row.metadataJson))).filter(Boolean))] as string[],
      engines: [...new Set(filtered.map((row) => getMetadataEngine(parseRecommendationMetadata(row.metadataJson))).filter(Boolean))] as string[],
      resourceTypes: [...new Set(filtered.map((row) => row.resourceType ?? getMetadataResourceType(parseRecommendationMetadata(row.metadataJson))).filter(Boolean))] as string[],
      regions: [...new Set(filtered.map((row) => row.awsRegionCode ?? getMetadataRegion(parseRecommendationMetadata(row.metadataJson))).filter(Boolean))] as string[],
    };

    return {
      items: paged.map(mapListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      filterOptions,
    };
  }

  async getById(input: { tenantId: string; id: string }): Promise<DbRecommendationDetail | null> {
    const row = await FactRecommendations.findOne({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        category: DB_CATEGORY,
      },
    });
    if (!row) return null;

    const base = mapListItem(row);
    const metadata = parseRecommendationMetadata(row.metadataJson);

    return {
      ...base,
      metadata_json: (metadata as Record<string, unknown> | null) ?? null,
      evidence: {
        signals_used: parseSignalsUsed(metadata?.signals_used),
        signals_missing: parseSignalsMissing(metadata?.signals_missing),
        cost_breakdown:
          metadata && typeof metadata.cost_breakdown === "object" && metadata.cost_breakdown !== null
            ? (metadata.cost_breakdown as Record<string, unknown>)
            : {},
        savings_assumptions:
          metadata && typeof metadata.savings_assumptions === "object" && metadata.savings_assumptions !== null
            ? (metadata.savings_assumptions as Record<string, unknown>)
            : {},
        data_quality_warnings: parseMetadataWarnings(metadata?.data_quality_warnings),
        source_tables: asStringArray(metadata?.source_tables),
      },
      lifecycle: {
        status_reason: row.statusReason ?? null,
        snoozed_until: toIso(row.snoozedUntil),
        status_updated_at: toIso(row.statusUpdatedAt),
        status_updated_by: row.statusUpdatedBy ?? null,
        detected_at: toIso(row.detectedAt),
        last_seen_at: toIso(row.lastSeenAt),
      },
    };
  }

  async getSummary(input: { tenantId: string; cloudConnectionId?: string }): Promise<DbRecommendationSummary> {
    const rows = await sequelize.query<{
      status: string;
      recommendationType: string;
      confidence: string | null;
      evidenceLevel: string | null;
      warningsCount: number;
      estimatedSavings: number;
      updatedAt: string | null;
    }>(
      `
      SELECT
        fr.status AS status,
        fr.recommendation_type AS "recommendationType",
        NULLIF(fr.metadata_json->>'confidence', '') AS confidence,
        NULLIF(fr.metadata_json->>'evidence_level', '') AS "evidenceLevel",
        COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(fr.metadata_json->'data_quality_warnings') = 'array' THEN fr.metadata_json->'data_quality_warnings' ELSE '[]'::jsonb END), 0)::int AS "warningsCount",
        COALESCE(fr.estimated_monthly_savings, 0)::double precision AS "estimatedSavings",
        CASE WHEN fr.updated_at IS NULL THEN NULL ELSE fr.updated_at::text END AS "updatedAt"
      FROM fact_recommendations fr
      WHERE fr.tenant_id = :tenantId::uuid
        AND fr.category = 'DB'
        AND (:cloudConnectionId::uuid IS NULL OR fr.cloud_connection_id = :cloudConnectionId::uuid)
      `,
      {
        replacements: { tenantId: input.tenantId, cloudConnectionId: input.cloudConnectionId ?? null },
        type: QueryTypes.SELECT,
      },
    );

    const summary: DbRecommendationSummary = {
      total: rows.length,
      byStatus: {},
      byType: {},
      byConfidence: {},
      byEvidenceLevel: {},
      warningsCount: 0,
      estimatedSavingsTotal: 0,
      lastGeneratedAt: null,
      activeCount: 0,
      resolvedCount: 0,
    };

    let latestUpdatedAt: string | null = null;

    for (const row of rows) {
      summary.byStatus[row.status] = (summary.byStatus[row.status] ?? 0) + 1;
      summary.byType[row.recommendationType] = (summary.byType[row.recommendationType] ?? 0) + 1;
      const confidence = row.confidence ?? "unknown";
      summary.byConfidence[confidence] = (summary.byConfidence[confidence] ?? 0) + 1;
      const evidenceLevel = row.evidenceLevel ?? "unknown";
      summary.byEvidenceLevel[evidenceLevel] = (summary.byEvidenceLevel[evidenceLevel] ?? 0) + 1;
      summary.warningsCount += toNumber(row.warningsCount);
      summary.estimatedSavingsTotal += toNumber(row.estimatedSavings);
      if (row.status === "COMPLETED") summary.resolvedCount += 1;
      else summary.activeCount += 1;
      if (row.updatedAt && (!latestUpdatedAt || row.updatedAt > latestUpdatedAt)) latestUpdatedAt = row.updatedAt;
    }

    summary.lastGeneratedAt = latestUpdatedAt;

    return summary;
  }

  async generate(input: DbRecommendationsGenerateInput): Promise<DbRecommendationsGenerateResult> {
    return this.generator.generate(input);
  }
}

export async function syncDbRecommendationsAfterIngestion(input: {
  tenantId: string;
  billingSourceId: string;
  ingestionRunId: string;
  cloudConnectionId?: string | null;
}): Promise<DbRecommendationsGenerateResult> {
  const service = new DbRecommendationsService();
  const result = await service.generate({
    tenantId: input.tenantId,
    billingSourceId: Number.isFinite(Number(input.billingSourceId)) ? Number(input.billingSourceId) : undefined,
    cloudConnectionId: input.cloudConnectionId ?? undefined,
  });

  logger.info("DB recommendations sync completed after ingestion", {
    ingestionRunId: input.ingestionRunId,
    tenantId: input.tenantId,
    billingSourceId: input.billingSourceId,
    cloudConnectionId: input.cloudConnectionId ?? null,
    resourcesEvaluated: result.resourcesEvaluated,
    created: result.created,
    updated: result.updated,
    resolved: result.resolved,
    skipped: result.skipped,
    failed: result.failed,
    warnings: result.warnings.length,
  });

  return result;
}
