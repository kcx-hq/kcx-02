import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetDatabaseExplorer } from "./explorer/explorer.controller.js";

const router = Router();

router.use("/services/database", requireAuth);
router.get("/services/database/explorer", asyncHandler(handleGetDatabaseExplorer));

export default router;
