import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  confirmAdminDemoRequest,
  getAdminDemoRequestById,
  getAdminDemoRequests,
  rejectAdminDemoRequest,
} from "./admin-demo-requests.service.js";
import { parseAdminDemoRequestParams } from "./admin-demo-requests.validator.js";

export async function handleAdminGetDemoRequests(req: Request, res: Response): Promise<void> {
  const requests = await getAdminDemoRequests();

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo requests fetched",
    data: requests,
  });
}

export async function handleAdminGetDemoRequestById(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminDemoRequestParams(req.params);
  const request = await getAdminDemoRequestById(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo request fetched",
    data: request,
  });
}

export async function handleAdminConfirmDemoRequest(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminDemoRequestParams(req.params);
  const result = await confirmAdminDemoRequest(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo request confirmed",
    data: result,
  });
}

export async function handleAdminRejectDemoRequest(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminDemoRequestParams(req.params);
  const result = await rejectAdminDemoRequest(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo request rejected",
    data: result,
  });
}
