import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import {
  changeMemberRole,
  createOrg,
  inviteMember,
  listMembers,
  listMyOrgs,
  removeMember,
} from "../controllers/orgController.js";
import { validateObjectId } from "../middlewares/validateId.js";


const router = Router();

router.param("orgId", validateObjectId);
router.param("memberId", validateObjectId);


router.use(verifyToken);

router.post("/", createOrg);
router.post("/:orgId/invite", requireOrgMembership("lead"), inviteMember);
router.get("/:orgId/members", requireOrgMembership(), listMembers);
router.get("/mine", listMyOrgs);
router.patch("/:orgId/members/:memberId", requireOrgMembership("lead"), changeMemberRole);
router.delete("/:orgId/members/:memberId", requireOrgMembership(), removeMember);

export default router;