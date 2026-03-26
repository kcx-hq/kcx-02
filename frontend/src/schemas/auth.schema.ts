import { z } from "zod"
import { workEmailSchema } from "@/schemas/email.schema"

const trimmed = z
  .string()
  .transform((value) => value.trim())

export const loginSchema = z.object({
  email: workEmailSchema,
  password: trimmed.pipe(z.string().min(6, "Password must be at least 6 characters.")),
})

export type LoginValues = z.input<typeof loginSchema>
export type LoginData = z.output<typeof loginSchema>
