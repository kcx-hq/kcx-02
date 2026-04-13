import { Router } from "express";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetAnomalies } from "./anomaly.controller.js";

const router = Router();

router.get("/", asyncHandler(handleGetAnomalies));

export default router;
