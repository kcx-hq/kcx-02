import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import { scheduleDemoSchema, type ScheduleDemoInput } from "./schedule-demo.schema.js";

export const parseScheduleDemoBody = (body: unknown): ScheduleDemoInput =>
  parseWithSchema(scheduleDemoSchema, body);
