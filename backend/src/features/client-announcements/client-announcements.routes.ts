import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetClientAnnouncements } from "./client-announcements.controller.js";

const router = Router();

router.use("/announcements/client", requireAuth);
router.get("/announcements/client", asyncHandler(handleGetClientAnnouncements));

export default router;
