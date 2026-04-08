import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { parseAdminLoginBody } from "./admin-auth.validator.js";
import { loginAdminWithEmailPassword } from "./admin-auth.service.js";

export async function handleAdminLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = parseAdminLoginBody(req.body);
  const result = await loginAdminWithEmailPassword(email, password);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Admin login successful",
    data: result,
  });
}
