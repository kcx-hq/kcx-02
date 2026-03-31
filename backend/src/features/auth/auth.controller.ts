import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  loginWithEmailPassword,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./auth.service.js";
import {
  parseForgotPasswordBody,
  parseLoginBody,
  parseResetPasswordBody,
} from "./auth.validator.js";

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = parseLoginBody(req.body);
  const result = await loginWithEmailPassword(email, password);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Login successful",
    data: result,
  });
}

export async function handleAuthMe(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Authenticated user fetched",
    data: {
      user: req.auth?.user ?? null,
    },
  });
}

export async function handleForgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = parseForgotPasswordBody(req.body);
  const result = await requestPasswordReset(email);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "If the email exists, a reset link has been sent",
    data: result,
  });
}

export async function handleResetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = parseResetPasswordBody(req.body);
  const result = await resetPasswordWithToken(token, newPassword);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Password reset successful",
    data: result,
  });
}
