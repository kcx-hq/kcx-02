import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleForgotPassword, handleLogin, handleResetPassword } from "./auth.controller.js";

const router = Router();

router.post("/auth/login", asyncHandler(handleLogin));
router.post("/auth/forgot-password", asyncHandler(handleForgotPassword));
router.post("/auth/reset-password", asyncHandler(handleResetPassword));

export default router;
