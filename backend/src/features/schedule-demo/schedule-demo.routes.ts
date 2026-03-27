import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetScheduleDemoSlots, handleScheduleDemo } from "./schedule-demo.controller.js";

const router = Router();

router.get("/schedule-demo/slots", asyncHandler(handleGetScheduleDemoSlots));
router.post("/schedule-demo", asyncHandler(handleScheduleDemo));

export default router;
