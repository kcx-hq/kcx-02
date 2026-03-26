import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from "./auth.schema.js";

export const parseLoginBody = (body: unknown): LoginInput => parseWithSchema(loginSchema, body);

export const parseForgotPasswordBody = (body: unknown): ForgotPasswordInput =>
  parseWithSchema(forgotPasswordSchema, body);

export const parseResetPasswordBody = (body: unknown): ResetPasswordInput =>
  parseWithSchema(resetPasswordSchema, body);
