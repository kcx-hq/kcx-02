import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import {
  adminDemoRequestParamsSchema,
  type AdminDemoRequestParamsInput,
} from "./admin-demo-requests.schema.js";

export const parseAdminDemoRequestParams = (params: unknown): AdminDemoRequestParamsInput =>
  parseWithSchema(adminDemoRequestParamsSchema, params);
