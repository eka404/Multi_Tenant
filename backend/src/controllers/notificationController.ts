import type { Response } from "express";
import { Notification } from "../models/Notification.js";
import type { AuthedRequest } from "../middlewares/auth.js";

export async function listNotifications(req: AuthedRequest, res: Response) {
  const notifications = await Notification.find({ userId: req.userId })
    .populate("ticketId", "title projectId orgId")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ notifications });
}

export async function markRead(req: AuthedRequest, res: Response) {
  const notificationId = Array.isArray(req.params.notificationId)
    ? req.params.notificationId[0]
    : req.params.notificationId;
  if (!notificationId) return res.status(400).json({ message: "Notification ID is required" });

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId: req.userId },
    { $set: { read: true } },
    { new: true }
  ).populate("ticketId", "title projectId orgId");
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification });
}

export async function markAllRead(req: AuthedRequest, res: Response) {
  await Notification.updateMany({ userId: req.userId, read: false }, { $set: { read: true } });
  res.json({ message: "All marked read" });
}

export async function markTicketNotificationsRead(req: AuthedRequest, res: Response) {
  const ticketId = Array.isArray(req.params.ticketId)
    ? req.params.ticketId[0]
    : req.params.ticketId;
  if (!ticketId) return res.status(400).json({ message: "Ticket ID is required" });

  await Notification.updateMany(
    { userId: req.userId, ticketId, read: false },
    { $set: { read: true } }
  );
  res.json({ message: "Ticket notifications marked as read" });
}