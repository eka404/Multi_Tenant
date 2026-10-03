import {Router} from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { createProject, listProjects } from "../controllers/projectController.js";

const router = Router();
router.use(verifyToken);

router.post("/:orgId/projects", requireOrgMembership("lead"), createProject);
router.get("/:orgId/projects", requireOrgMembership(), listProjects);

export default router;