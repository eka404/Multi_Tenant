import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { createComment, listComments } from "../controllers/commentController.js";
import { validateObjectId } from "../middlewares/validateId.js";

const router = Router();

router.param("orgId", validateObjectId);
router.param("ticketId", validateObjectId);

router.use(verifyToken);

router.post("/:orgId/tickets/:ticketId/comments", requireOrgMembership("contributor"), createComment);
router.get("/:orgId/tickets/:ticketId/comments", requireOrgMembership(), listComments);

export default router;