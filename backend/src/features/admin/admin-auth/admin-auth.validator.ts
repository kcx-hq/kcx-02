import { adminLoginSchema, type AdminLoginInput } from "./admin-auth.schema.js";

export const parseAdminLoginBody = (body: unknown): AdminLoginInput => {
  return adminLoginSchema.parse(body);
};

