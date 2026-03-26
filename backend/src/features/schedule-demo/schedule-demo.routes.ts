import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleScheduleDemo } from "./schedule-demo.controller.js";

const router = Router();

router.post("/schedule-demo", asyncHandler(handleScheduleDemo));

export default router;
