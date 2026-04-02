import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAdminAuth } from "../../middlewares/auth.middleware.js";
import {
  handleAdminConfirmDemoRequest,
  handleAdminGetDemoRequestById,
  handleAdminGetDemoRequests,
  handleAdminRejectDemoRequest,
} from "./admin-demo-requests.controller.js";

const router = Router();

router.use("/admin", requireAdminAuth);

router.get("/admin/demo-requests", asyncHandler(handleAdminGetDemoRequests));
router.get("/admin/demo-requests/:id", asyncHandler(handleAdminGetDemoRequestById));
router.patch("/admin/demo-requests/:id/confirm", asyncHandler(handleAdminConfirmDemoRequest));
router.patch("/admin/demo-requests/:id/reject", asyncHandler(handleAdminRejectDemoRequest));

export default router;
