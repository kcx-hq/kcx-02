import { z } from "zod";

const announcementStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const announcementAudienceScopeSchema = z.enum(["ALL", "CLIENT_IDS", "CLIENT_TIER"]);
const announcementAudienceTierSchema = z.enum(["PREMIUM", "STANDARD"]);
const isoDatetimeOrNullSchema = z.string().datetime({ offset: true }).nullable();

export const adminAnnouncementParamsSchema = z.object({
  id: z.string().uuid(),
});

export const adminAnnouncementListQuerySchema = z.object({
  search: z.string().trim().optional().default(""),
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    announcementStatusSchema.optional(),
  ),
  sort: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const createAdminAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  status: announcementStatusSchema.optional(),
  audience_scope: announcementAudienceScopeSchema.optional(),
  audience_client_ids: z.array(z.string().uuid()).nullable().optional(),
  audience_tier: announcementAudienceTierSchema.nullable().optional(),
  publish_at: isoDatetimeOrNullSchema.optional(),
  expires_at: isoDatetimeOrNullSchema.optional(),
});

export const updateAdminAnnouncementSchema = createAdminAnnouncementSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type AdminAnnouncementParamsInput = z.output<typeof adminAnnouncementParamsSchema>;
export type AdminAnnouncementListQueryInput = z.output<typeof adminAnnouncementListQuerySchema>;
export type CreateAdminAnnouncementInput = z.output<typeof createAdminAnnouncementSchema>;
export type UpdateAdminAnnouncementInput = z.output<typeof updateAdminAnnouncementSchema>;
