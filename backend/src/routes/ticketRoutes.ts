import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { createTicket, updateTicket, listTickets, deleteTicket } from "../controllers/ticketController.js";
import { requireOrgMembership } from "../middlewares/requireOrgMembership.js";

const router = Router();
router.use(verifyToken);

router.post("/:orgId/projects/:projectId/tickets", requireOrgMembership(), createTicket);
router.get("/:orgId/projects/:projectId/tickets", requireOrgMembership(), listTickets);
router.patch("/:orgId/tickets/:ticketId", requireOrgMembership(), updateTicket);
router.delete("/:orgId/tickets/:ticketId", requireOrgMembership("lead"), deleteTicket);

export default router;