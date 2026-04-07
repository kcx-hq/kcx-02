import { Router } from "express";
import adminClientsRoutes from "../admin/admin-clients/admin-clients.routes.js";
import adminDemoRequestsRoutes from "../admin/admin-demo-requests/admin-demo-requests.routes.js";
import adminBillingUploadsRoutes from "../admin/admin-billing-uploads/admin-billing-uploads.routes.js";
import adminAuthRoutes from "../admin/admin-auth/admin-auth.routes.js";
import authRoutes from "../auth/auth.routes.js";
import awsAutoCloudConnectionsRoutes from "../cloud-connections/aws/auto-connection/cloud-connections.routes.js";
import awsManualConnectionRoutes from "../cloud-connections/aws/manual-connection/manual-connection.routes.js";
import scheduleDemoRoutes from "../schedule-demo/schedule-demo.routes.js";
import billingRoutes from "../billing/billing.routes.js";
import dashboardRoutes from "../dashboard/dashboard.routes.js";
import awsExportFileEventRoutes from "../cloud-connections/aws/exports/aws-export-file-event.routes.js";
const router = Router();

router.use(scheduleDemoRoutes);
router.use(authRoutes);
router.use(awsAutoCloudConnectionsRoutes);
router.use(awsManualConnectionRoutes);
router.use(billingRoutes);
router.use(dashboardRoutes);
router.use(adminAuthRoutes);
router.use(adminClientsRoutes);
router.use(adminDemoRequestsRoutes);
router.use(adminBillingUploadsRoutes);
router.use(awsExportFileEventRoutes);

export default router;

