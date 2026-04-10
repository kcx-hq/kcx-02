import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import overviewRoutes from "./overview/overview.routes.js";
import costExplorerRoutes from "./cost-explorer/cost-explorer.routes.js";
import anomaliesAlertsRoutes from "./anomalies-alerts/anomalies-alerts.routes.js";

const router = Router();

router.use("/upload-dashboard", requireAuth);
router.use("/upload-dashboard/overview", overviewRoutes);
router.use("/upload-dashboard/cost-explorer", costExplorerRoutes);
router.use("/upload-dashboard/anomalies-alerts", anomaliesAlertsRoutes);

export default router;
