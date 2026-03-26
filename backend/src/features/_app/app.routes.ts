import { Router } from "express";
import authRoutes from "../auth/auth.routes.js";
import scheduleDemoRoutes from "../schedule-demo/schedule-demo.routes.js";

const router = Router();

router.use(scheduleDemoRoutes);
router.use(authRoutes);

export default router;

