import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGenerateDbRecommendations,
  handleGetDbRecommendationDetail,
  handleGetDbRecommendations,
  handleGetDbRecommendationsSummary,
} from "./db-recommendations.controller.js";

const router = Router();

router.get("/services/database/recommendations", asyncHandler(handleGetDbRecommendations));
router.get("/services/database/recommendations/summary", asyncHandler(handleGetDbRecommendationsSummary));
router.get("/services/database/recommendations/:id", asyncHandler(handleGetDbRecommendationDetail));
router.post("/services/database/recommendations/generate", asyncHandler(handleGenerateDbRecommendations));

export default router;
