import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import {
  inviteOrganizationUserSchema,
  organizationUserIdParamSchema,
  updateOrganizationUserStatusSchema,
  type InviteOrganizationUserInput,
  type OrganizationUserIdParamInput,
  type UpdateOrganizationUserStatusInput,
} from "./organization-users.schema.js";

export const parseInviteOrganizationUserBody = (body: unknown): InviteOrganizationUserInput =>
  parseWithSchema(inviteOrganizationUserSchema, body);

export const parseOrganizationUserIdParam = (params: unknown): OrganizationUserIdParamInput =>
  parseWithSchema(organizationUserIdParamSchema, params);

export const parseUpdateOrganizationUserStatusBody = (body: unknown): UpdateOrganizationUserStatusInput =>
  parseWithSchema(updateOrganizationUserStatusSchema, body);

