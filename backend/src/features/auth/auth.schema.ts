import { z } from "zod";
import { workEmailSchema } from "../_shared/validation/email.schema.js";

const trimmed = z.string().transform((value) => value.trim());

export const loginSchema = z.object({
  email: workEmailSchema,
  password: trimmed.pipe(z.string().min(6, "Password must be at least 6 characters.")),
});

export const forgotPasswordSchema = z.object({
  email: workEmailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: trimmed.pipe(z.string().min(10, "Token is required.")),
    newPassword: trimmed.pipe(z.string().min(8, "Password must be at least 8 characters.")),
    confirmPassword: trimmed.pipe(z.string().min(8, "Confirm your password.")),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export type LoginInput = z.output<typeof loginSchema>;
export type ForgotPasswordInput = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;

