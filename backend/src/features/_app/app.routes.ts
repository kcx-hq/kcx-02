import { Router } from "express";
import adminClientsRoutes from "../admin-clients/admin-clients.routes.js";
import adminDemoRequestsRoutes from "../admin-demo-requests/admin-demo-requests.routes.js";
import adminAuthRoutes from "../admin-auth/admin-auth.routes.js";
import authRoutes from "../auth/auth.routes.js";
import awsManualCloudConnectionsRoutes from "../cloud-connections/aws/manual-connection/cloud-connections.routes.js";
import awsAutoCloudConnectionsRoutes from "../cloud-connections/aws/auto-connection/cloud-connections.routes.js";
import scheduleDemoRoutes from "../schedule-demo/schedule-demo.routes.js";
import billingRoutes from "../billing/billing.routes.js";

const router = Router();

router.use(scheduleDemoRoutes);
router.use(authRoutes);
router.use(awsManualCloudConnectionsRoutes);
router.use(awsAutoCloudConnectionsRoutes);
router.use(billingRoutes);
router.use(adminAuthRoutes);
router.use(adminClientsRoutes);
router.use(adminDemoRequestsRoutes);

export default router;

