import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { createOrg, inviteMember, listMembers, listMyOrgs } from "../controllers/orgController.js";

const router = Router();
router.use(verifyToken);

router.post("/", createOrg);
router.post("/:orgId/invite", requireOrgMembership("lead"), inviteMember);
router.get("/:orgId/members", requireOrgMembership(), listMembers);
router.get("/mine", listMyOrgs);

export default router;