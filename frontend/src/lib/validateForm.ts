import type { z } from "zod"

export type FormErrors<TValues extends Record<string, unknown>> = Partial<Record<keyof TValues, string>>

export function validateForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  values: unknown
): { success: true; data: z.output<TSchema>; errors: {} } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(values)
  if (result.success) return { success: true, data: result.data, errors: {} }

  const flattened = result.error.flatten()
  const errors: Record<string, string> = {}
  const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>
  for (const key of Object.keys(fieldErrors)) {
    const message = fieldErrors[key]?.[0]
    if (message) errors[key] = message
  }
  return { success: false, errors }
}
