import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetDatabaseAssetDetail, handleGetDatabaseAssets } from "./assets/assets.controller.js";
import { handleGetDatabaseExplorer } from "./explorer/explorer.controller.js";

const router = Router();

router.use("/services/database", requireAuth);
router.get("/services/database/explorer", asyncHandler(handleGetDatabaseExplorer));
router.get("/services/database/assets", asyncHandler(handleGetDatabaseAssets));
router.get("/services/database/assets/:resourceId/details", asyncHandler(handleGetDatabaseAssetDetail));

export default router;
