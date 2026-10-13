import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { validateObjectId } from "../middlewares/validateId.js";
import { getAnalytics } from "../controllers/analyticsController.js";

const router = Router();
router.param("orgId", validateObjectId);
router.use(verifyToken);

router.get("/:orgId/analytics", requireOrgMembership("lead"), getAnalytics);

export default router;