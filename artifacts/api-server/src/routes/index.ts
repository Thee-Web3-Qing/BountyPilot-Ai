import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { bountiesRouter } from "./bounties";
import { researchRouter } from "./research";
import { productionRouter } from "./production";
import { submissionsRouter } from "./submissions";
import { earningsRouter } from "./earnings";
import { dashboardRouter } from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bounties", bountiesRouter);
router.use("/research-briefs", researchRouter);
router.use("/production-plans", productionRouter);
router.use("/submissions", submissionsRouter);
router.use("/earnings", earningsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
