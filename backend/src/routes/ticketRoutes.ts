import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { createTicket, updateTicket, listTickets, deleteTicket } from "../controllers/ticketController.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";
import { validateObjectId } from "../middlewares/validateId.js";
import { searchTickets } from "../controllers/searchController.js";
import { searchLimiter } from "../middlewares/rateLimiters.js";


const router = Router();

router.param("orgId", validateObjectId);
router.param("projectId", validateObjectId);
router.param("ticketId", validateObjectId);

router.use(verifyToken);

router.post("/:orgId/projects/:projectId/tickets", requireOrgMembership("contributor"), createTicket);
router.patch("/:orgId/tickets/:ticketId", requireOrgMembership("contributor"), updateTicket);
router.get("/:orgId/projects/:projectId/tickets", requireOrgMembership(), listTickets);
router.delete("/:orgId/tickets/:ticketId", requireOrgMembership("lead"), deleteTicket);
router.get("/:orgId/search/tickets", searchLimiter, requireOrgMembership(), searchTickets);

export default router;