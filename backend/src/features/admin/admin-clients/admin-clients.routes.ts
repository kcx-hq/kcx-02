import { Router } from "express";

import { requireAdminAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleAdminGetClients } from "./admin-clients.controller.js";

const router = Router();

router.use("/admin", requireAdminAuth);

router.get("/admin/clients", asyncHandler(handleAdminGetClients));

export default router;

