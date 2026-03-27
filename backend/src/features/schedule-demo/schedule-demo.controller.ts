import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { getAvailableSlots, submitScheduleDemo } from "./schedule-demo.service.js";
import { parseScheduleDemoBody, parseScheduleDemoSlotsQuery } from "./schedule-demo.validator.js";

export async function handleScheduleDemo(req: Request, res: Response): Promise<void> {
  const input = parseScheduleDemoBody(req.body);
  const result = await submitScheduleDemo(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Demo request submitted",
    data: result,
  });
}

export async function handleGetScheduleDemoSlots(req: Request, res: Response): Promise<void> {
  const { start, end } = parseScheduleDemoSlotsQuery(req.query);
  const slots = await getAvailableSlots(start, end);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo slots fetched",
    data: slots,
  });
}
