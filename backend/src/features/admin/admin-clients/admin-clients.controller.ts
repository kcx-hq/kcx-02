import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getAdminClients } from "./admin-clients.service.js";

export async function handleAdminGetClients(req: Request, res: Response): Promise<void> {
  const clients = await getAdminClients();

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Clients fetched",
    data: clients,
  });
}

