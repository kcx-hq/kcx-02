import { Op, type WhereOptions } from "sequelize";

import { Announcement } from "../../models/index.js";

type AnnouncementInstance = InstanceType<typeof Announcement>;

export type ClientAnnouncementSummary = {
  id: string;
  title: string;
  body: string;
  publishAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
};

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const toClientAnnouncementSummary = (
  announcement: AnnouncementInstance,
): ClientAnnouncementSummary => ({
  id: announcement.id,
  title: announcement.title,
  body: announcement.body,
  publishAt: toIso(announcement.publishAt),
  expiresAt: toIso(announcement.expiresAt),
  updatedAt: announcement.updatedAt.toISOString(),
});

const normalizeRoleToTier = (role: string | undefined): string | null => {
  if (!role) return null;
  const normalized = role.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "PREMIUM" || normalized === "STANDARD") return normalized;
  if (normalized.includes("PREMIUM")) return "PREMIUM";
  if (normalized.includes("STANDARD")) return "STANDARD";
  return null;
};

export async function getClientAnnouncements(params: {
  userId: string;
  userRole?: string;
}): Promise<ClientAnnouncementSummary[]> {
  const now = new Date();
  const userTier = normalizeRoleToTier(params.userRole);

  const audienceFilter: WhereOptions[] = [
    { audienceScope: "ALL" },
    {
      audienceScope: "CLIENT_IDS",
      audienceClientIds: { [Op.contains]: [params.userId] },
    },
  ];

  if (userTier) {
    audienceFilter.push({
      audienceScope: "CLIENT_TIER",
      audienceTier: userTier,
    });
  }

  const where: WhereOptions = {
    status: "PUBLISHED",
    [Op.and]: [
      {
        [Op.or]: [{ publishAt: null }, { publishAt: { [Op.lte]: now } }],
      },
      {
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
      },
      { [Op.or]: audienceFilter },
    ],
  };

  const announcements = await Announcement.findAll({
    where,
    order: [
      ["publishAt", "DESC"],
      ["updatedAt", "DESC"],
    ],
    limit: 20,
  });

  return announcements.map(toClientAnnouncementSummary);
}
