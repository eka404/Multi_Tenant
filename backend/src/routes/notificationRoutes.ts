import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  listNotifications,
  markRead,
  markAllRead,
  markTicketNotificationsRead,
} from "../controllers/notificationController.js";

const router = Router();
router.use(verifyToken);

router.get("/", listNotifications);
router.patch("/ticket/:ticketId/read", markTicketNotificationsRead);
router.patch("/read-all", markAllRead);
router.patch("/:notificationId/read", markRead);

export default router;