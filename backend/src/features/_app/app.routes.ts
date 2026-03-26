import { Router } from "express";
import adminDemoRequestsRoutes from "../admin-demo-requests/admin-demo-requests.routes.js";
import authRoutes from "../auth/auth.routes.js";
import scheduleDemoRoutes from "../schedule-demo/schedule-demo.routes.js";

const router = Router();

router.use(scheduleDemoRoutes);
router.use(authRoutes);
router.use(adminDemoRequestsRoutes);

export default router;

