import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { createComment, listComments } from "../controllers/commentController.js";

const router = Router();
router.use(verifyToken);

router.post("/:orgId/tickets/:ticketId/comments", requireOrgMembership(), createComment);
router.get("/:orgId/tickets/:ticketId/comments", requireOrgMembership(), listComments);

export default router;