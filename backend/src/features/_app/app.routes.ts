import { Router } from "express";
import adminClientsRoutes from "../admin-clients/admin-clients.routes.js";
import adminDemoRequestsRoutes from "../admin-demo-requests/admin-demo-requests.routes.js";
import adminAuthRoutes from "../admin-auth/admin-auth.routes.js";
import authRoutes from "../auth/auth.routes.js";
import scheduleDemoRoutes from "../schedule-demo/schedule-demo.routes.js";

const router = Router();

router.use(scheduleDemoRoutes);
router.use(authRoutes);
router.use(adminAuthRoutes);
router.use(adminClientsRoutes);
router.use(adminDemoRequestsRoutes);

export default router;

