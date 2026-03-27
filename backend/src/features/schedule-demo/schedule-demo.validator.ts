import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import {
  scheduleDemoSchema,
  scheduleDemoSlotsDateParamSchema,
  scheduleDemoSlotsQuerySchema,
  scheduleDemoSlotsTimeZoneQuerySchema,
  type ScheduleDemoSlotsDateParamInput,
  type ScheduleDemoInput,
  type ScheduleDemoSlotsQueryInput,
  type ScheduleDemoSlotsTimeZoneQueryInput,
} from "./schedule-demo.schema.js";

export const parseScheduleDemoBody = (body: unknown): ScheduleDemoInput =>
  parseWithSchema(scheduleDemoSchema, body);

export const parseScheduleDemoSlotsQuery = (query: unknown): ScheduleDemoSlotsQueryInput =>
  parseWithSchema(scheduleDemoSlotsQuerySchema, query);

export const parseScheduleDemoSlotsDateParam = (params: unknown): ScheduleDemoSlotsDateParamInput =>
  parseWithSchema(scheduleDemoSlotsDateParamSchema, params);

export const parseScheduleDemoSlotsTimeZoneQuery = (
  query: unknown,
): ScheduleDemoSlotsTimeZoneQueryInput => parseWithSchema(scheduleDemoSlotsTimeZoneQuerySchema, query);
