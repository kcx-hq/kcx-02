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

export const forgotPasswordSchema = z.object({
  email: workEmailSchema,
})

export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>
export type ForgotPasswordData = z.output<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    newPassword: trimmed.pipe(z.string().min(8, "Password must be at least 8 characters.")),
    confirmPassword: trimmed.pipe(z.string().min(8, "Confirm your password.")),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      })
    }
  })

export type ResetPasswordValues = z.input<typeof resetPasswordSchema>
export type ResetPasswordData = z.output<typeof resetPasswordSchema>
