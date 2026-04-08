import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import { requireAdminAuth } from "../../../middlewares/auth.middleware.js";
import { handleAdminLogin } from "./admin-auth.controller.js";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";

const router = Router();

router.post("/admin/auth/login", asyncHandler(handleAdminLogin));

router.get(
  "/admin/auth/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "Authenticated",
      data: { admin: req.auth?.user ?? null },
    });
  }),
);

export default router;

