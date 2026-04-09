import { Op, type WhereOptions } from "sequelize";

import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { Announcement } from "../../../models/index.js";
import type {
  AdminAnnouncementListQueryInput,
  CreateAdminAnnouncementInput,
  UpdateAdminAnnouncementInput,
} from "./admin-announcements.schema.js";

type AnnouncementInstance = InstanceType<typeof Announcement>;

type AdminAnnouncementSummary = {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  audience: "ALL";
  audience_scope: "ALL" | "CLIENT_IDS" | "CLIENT_TIER";
  audience_client_ids: string[] | null;
  audience_tier: "PREMIUM" | "STANDARD" | null;
  publish_at: string | null;
  expires_at: string | null;
  created_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

type AdminAnnouncementListResponse = {
  items: AdminAnnouncementSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toDateOrNull = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError("Invalid date value");
  }
  return date;
};

const toAnnouncementSummary = (announcement: AnnouncementInstance): AdminAnnouncementSummary => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  status: announcement.status,
  audience: "ALL",
  audience_scope: announcement.audienceScope,
  audience_client_ids: announcement.audienceClientIds,
  audience_tier: announcement.audienceTier,
  publish_at: toIso(announcement.publishAt),
  expires_at: toIso(announcement.expiresAt),
  created_by_admin_id:
    announcement.createdByAdminId === null ? null : String(announcement.createdByAdminId),
  created_at: announcement.createdAt.toISOString(),
  updated_at: announcement.updatedAt.toISOString(),
});

const validateAudience = (input: {
  audienceScope: "ALL" | "CLIENT_IDS" | "CLIENT_TIER";
  audienceClientIds: string[] | null;
  audienceTier: "PREMIUM" | "STANDARD" | null;
}): void => {
  if (input.audienceScope === "ALL") {
    return;
  }

  if (input.audienceScope === "CLIENT_IDS") {
    if (!input.audienceClientIds || input.audienceClientIds.length === 0) {
      throw new BadRequestError("audience_client_ids is required when audience_scope is CLIENT_IDS");
    }
    return;
  }

  if (!input.audienceTier) {
    throw new BadRequestError("audience_tier is required when audience_scope is CLIENT_TIER");
  }
};

const validateDateRange = (publishAt: Date | null, expiresAt: Date | null): void => {
  if (publishAt && expiresAt && publishAt.getTime() >= expiresAt.getTime()) {
    throw new BadRequestError("publish_at must be earlier than expires_at");
  }
};

const getAnnouncementOrThrow = async (id: string): Promise<AnnouncementInstance> => {
  const announcement = await Announcement.findByPk(id);
  if (!announcement) throw new NotFoundError("Announcement not found");
  return announcement;
};

export async function getAdminAnnouncements(
  query: AdminAnnouncementListQueryInput,
): Promise<AdminAnnouncementListResponse> {
  const { page, limit, search, sort, status } = query;

  const where: WhereOptions = {};
  if (status) where.status = status;
  if (search) {
    Object.assign(where, {
      [Op.or]: [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } },
      ],
    });
  }

  const { rows, count } = await Announcement.findAndCountAll({
    where,
    order: [["updatedAt", sort], ["createdAt", sort]],
    offset: (page - 1) * limit,
    limit,
  });

  return {
    items: rows.map((item) => toAnnouncementSummary(item)),
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}

export async function createAdminAnnouncement(
  input: CreateAdminAnnouncementInput,
  adminId: number | null,
): Promise<AdminAnnouncementSummary> {
  const audienceScope = input.audience_scope ?? "ALL";
  const audienceClientIds = audienceScope === "CLIENT_IDS" ? (input.audience_client_ids ?? null) : null;
  const audienceTier = audienceScope === "CLIENT_TIER" ? (input.audience_tier ?? null) : null;
  const publishAt = toDateOrNull(input.publish_at) ?? null;
  const expiresAt = toDateOrNull(input.expires_at) ?? null;
  const status = input.status ?? "DRAFT";

  validateAudience({ audienceScope, audienceClientIds, audienceTier });
  validateDateRange(publishAt, expiresAt);

  const announcement = await Announcement.create({
    title: input.title.trim(),
    body: input.body.trim(),
    status,
    audience: "ALL",
    audienceScope,
    audienceClientIds,
    audienceTier,
    publishAt: status === "PUBLISHED" ? (publishAt ?? new Date()) : publishAt,
    expiresAt,
    createdByAdminId: adminId,
  });

  return toAnnouncementSummary(announcement);
}

export async function updateAdminAnnouncement(
  id: string,
  input: UpdateAdminAnnouncementInput,
): Promise<AdminAnnouncementSummary> {
  const announcement = await getAnnouncementOrThrow(id);

  const nextAudienceScope = input.audience_scope ?? announcement.audienceScope;
  const nextAudienceClientIds =
    nextAudienceScope === "CLIENT_IDS"
      ? (input.audience_client_ids ?? announcement.audienceClientIds)
      : null;
  const nextAudienceTier =
    nextAudienceScope === "CLIENT_TIER" ? (input.audience_tier ?? announcement.audienceTier) : null;
  const nextPublishAt =
    toDateOrNull(input.publish_at) ?? (input.publish_at === null ? null : announcement.publishAt);
  const nextExpiresAt =
    toDateOrNull(input.expires_at) ?? (input.expires_at === null ? null : announcement.expiresAt);
  const nextStatus = input.status ?? announcement.status;

  validateAudience({
    audienceScope: nextAudienceScope,
    audienceClientIds: nextAudienceClientIds,
    audienceTier: nextAudienceTier,
  });
  validateDateRange(nextPublishAt, nextExpiresAt);

  announcement.set({
    title: input.title !== undefined ? input.title.trim() : announcement.title,
    body: input.body !== undefined ? input.body.trim() : announcement.body,
    status: nextStatus,
    audienceScope: nextAudienceScope,
    audienceClientIds: nextAudienceClientIds,
    audienceTier: nextAudienceTier,
    publishAt: nextStatus === "PUBLISHED" ? (nextPublishAt ?? new Date()) : nextPublishAt,
    expiresAt: nextExpiresAt,
  });

  await announcement.save();
  return toAnnouncementSummary(announcement);
}

export async function publishAdminAnnouncement(id: string): Promise<AdminAnnouncementSummary> {
  const announcement = await getAnnouncementOrThrow(id);
  announcement.status = "PUBLISHED";
  announcement.publishAt = announcement.publishAt ?? new Date();
  await announcement.save();
  return toAnnouncementSummary(announcement);
}

export async function unpublishAdminAnnouncement(id: string): Promise<AdminAnnouncementSummary> {
  const announcement = await getAnnouncementOrThrow(id);
  announcement.status = "DRAFT";
  await announcement.save();
  return toAnnouncementSummary(announcement);
}

export async function archiveAdminAnnouncement(id: string): Promise<AdminAnnouncementSummary> {
  const announcement = await getAnnouncementOrThrow(id);
  announcement.status = "ARCHIVED";
  await announcement.save();
  return toAnnouncementSummary(announcement);
}
