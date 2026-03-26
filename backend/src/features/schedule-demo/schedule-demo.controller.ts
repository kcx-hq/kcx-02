import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { submitScheduleDemo } from "./schedule-demo.service.js";
import { parseScheduleDemoBody } from "./schedule-demo.validator.js";

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
