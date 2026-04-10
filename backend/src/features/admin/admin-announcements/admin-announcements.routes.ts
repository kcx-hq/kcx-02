import { Router } from "express";

import { requireAdminAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleAdminArchiveAnnouncement,
  handleAdminCreateAnnouncement,
  handleAdminGetAnnouncements,
  handleAdminPublishAnnouncement,
  handleAdminUnpublishAnnouncement,
  handleAdminUpdateAnnouncement,
} from "./admin-announcements.controller.js";

const router = Router();

router.use("/admin/announcements", requireAdminAuth);

router.get("/admin/announcements", asyncHandler(handleAdminGetAnnouncements));
router.post("/admin/announcements", asyncHandler(handleAdminCreateAnnouncement));
router.patch("/admin/announcements/:id", asyncHandler(handleAdminUpdateAnnouncement));
router.post("/admin/announcements/:id/publish", asyncHandler(handleAdminPublishAnnouncement));
router.post("/admin/announcements/:id/unpublish", asyncHandler(handleAdminUnpublishAnnouncement));
router.post("/admin/announcements/:id/archive", asyncHandler(handleAdminArchiveAnnouncement));

export default router;
