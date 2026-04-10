import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import {
  adminAnnouncementListQuerySchema,
  adminAnnouncementParamsSchema,
  createAdminAnnouncementSchema,
  updateAdminAnnouncementSchema,
  type AdminAnnouncementListQueryInput,
  type AdminAnnouncementParamsInput,
  type CreateAdminAnnouncementInput,
  type UpdateAdminAnnouncementInput,
} from "./admin-announcements.schema.js";

export const parseAdminAnnouncementParams = (params: unknown): AdminAnnouncementParamsInput =>
  parseWithSchema(adminAnnouncementParamsSchema, params);

export const parseAdminAnnouncementListQuery = (query: unknown): AdminAnnouncementListQueryInput =>
  parseWithSchema(adminAnnouncementListQuerySchema, query);

export const parseCreateAdminAnnouncementBody = (body: unknown): CreateAdminAnnouncementInput =>
  parseWithSchema(createAdminAnnouncementSchema, body);

export const parseUpdateAdminAnnouncementBody = (body: unknown): UpdateAdminAnnouncementInput =>
  parseWithSchema(updateAdminAnnouncementSchema, body);
