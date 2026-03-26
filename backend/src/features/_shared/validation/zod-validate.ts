import { z } from "zod";
import { ValidationError } from "../../../errors/http-errors.js";

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const flattened = result.error.flatten();
  throw new ValidationError("Validation failed", {
    formErrors: flattened.formErrors,
    fieldErrors: flattened.fieldErrors,
  });
}

