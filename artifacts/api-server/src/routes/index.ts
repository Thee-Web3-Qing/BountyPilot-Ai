import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./auth";
import { bountiesRouter } from "./bounties";
import { researchRouter } from "./research";
import { productionRouter } from "./production";
import { submissionsRouter } from "./submissions";
import { earningsRouter } from "./earnings";
import { dashboardRouter } from "./dashboard";
import { settingsRouter } from "./settings";
import { discoverRouter } from "./discover";
import { adminRouter } from "./admin";
import { mcpRouter } from "./mcp";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/bounties", bountiesRouter);
router.use("/research-briefs", researchRouter);
router.use("/production-plans", productionRouter);
router.use("/submissions", submissionsRouter);
router.use("/earnings", earningsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);
router.use("/discover", discoverRouter);
router.use("/admin", adminRouter);
router.use("/mcp", mcpRouter);

export default router;
