import { ValidationError } from "../../errors/http-errors.js";
import { isRecord, optionalString, requireEmail, requireString } from "../_shared/validation/validation-helpers.js";

export type LoginInput = { email: string; password: string };
export type ForgotPasswordInput = { email: string };
export type ResetPasswordInput = { token: string; newPassword: string; confirmPassword: string };

export const parseLoginBody = (body: unknown): LoginInput => {
  if (!isRecord(body)) {
    throw new ValidationError("Validation failed", { issue: "body_must_be_object" });
  }
  const email = requireEmail(body, "email");
  const password = requireString(body, "password");
  if (password.trim().length < 6) {
    throw new ValidationError("Validation failed", { field: "password", issue: "min_length_6" });
  }
  return { email, password };
};

export const parseForgotPasswordBody = (body: unknown): ForgotPasswordInput => {
  if (!isRecord(body)) {
    throw new ValidationError("Validation failed", { issue: "body_must_be_object" });
  }
  const email = requireEmail(body, "email");
  return { email };
};

export const parseResetPasswordBody = (body: unknown): ResetPasswordInput => {
  if (!isRecord(body)) {
    throw new ValidationError("Validation failed", { issue: "body_must_be_object" });
  }
  const token = requireString(body, "token");
  const newPassword = requireString(body, "newPassword");
  const confirmPassword = optionalString(body, "confirmPassword") ?? "";
  if (newPassword.length < 8) {
    throw new ValidationError("Validation failed", { field: "newPassword", issue: "min_length_8" });
  }
  if (newPassword !== confirmPassword) {
    throw new ValidationError("Validation failed", { field: "confirmPassword", issue: "passwords_mismatch" });
  }
  return { token, newPassword, confirmPassword };
};
