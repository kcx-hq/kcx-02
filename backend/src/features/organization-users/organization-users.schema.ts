import { z } from "zod";

import { workEmailSchema } from "../_shared/validation/email.schema.js";

const trimmedString = z.string().transform((value) => value.trim());

export const inviteOrganizationUserSchema = z.object({
  fullName: trimmedString.pipe(z.string().min(2, "Full name is required")),
  email: workEmailSchema,
  role: z.enum(["member", "admin"]).default("member"),
});

export const organizationUserIdParamSchema = z.object({
  userId: trimmedString.pipe(z.string().uuid("Invalid user id")),
});

export const updateOrganizationUserStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

export type InviteOrganizationUserInput = z.output<typeof inviteOrganizationUserSchema>;
export type OrganizationUserIdParamInput = z.output<typeof organizationUserIdParamSchema>;
export type UpdateOrganizationUserStatusInput = z.output<typeof updateOrganizationUserStatusSchema>;

