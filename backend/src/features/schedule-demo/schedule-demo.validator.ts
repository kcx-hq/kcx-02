import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import {
  scheduleDemoSchema,
  scheduleDemoSlotsQuerySchema,
  type ScheduleDemoInput,
  type ScheduleDemoSlotsQueryInput,
} from "./schedule-demo.schema.js";

export const parseScheduleDemoBody = (body: unknown): ScheduleDemoInput =>
  parseWithSchema(scheduleDemoSchema, body);

export const parseScheduleDemoSlotsQuery = (query: unknown): ScheduleDemoSlotsQueryInput =>
  parseWithSchema(scheduleDemoSlotsQuerySchema, query);
