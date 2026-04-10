import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getClientAnnouncements } from "./client-announcements.service.js";

export async function handleGetClientAnnouncements(req: Request, res: Response): Promise<void> {
  const userId = String(req.auth?.user?.id ?? "");
  const userRole = req.auth?.user?.role;
  const data = await getClientAnnouncements({ userId, userRole });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Client announcements fetched",
    data,
  });
}
