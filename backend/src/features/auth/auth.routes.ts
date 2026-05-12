import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  handleAuthMe,
  handleDecodeAuthToken,
  handleForgotPassword,
  handleLogin,
  handleResetPassword,
} from "./auth.controller.js";

const router = Router();

router.post("/auth/login", asyncHandler(handleLogin));
router.get("/auth/me", requireAuth, asyncHandler(handleAuthMe));
router.get("/auth/decode-token", requireAuth, asyncHandler(handleDecodeAuthToken));
router.post("/auth/forgot-password", asyncHandler(handleForgotPassword));
router.post("/auth/reset-password", asyncHandler(handleResetPassword));

export default router;
