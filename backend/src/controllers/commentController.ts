import type { Response } from "express";
import { Comment } from "../models/Comment.js";
import { Notification } from "../models/Notification.js";
import { Membership } from "../models/Membership.js";
import { User } from "../models/User.js";
import { Ticket } from "../models/Ticket.js";
import { getIO } from "../socket.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";

async function resolveMentions(body: string, orgId: string): Promise<string[]> {
  const names = [...body.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase());
  if (names.length === 0) return [];

  const memberships = await Membership.find({ orgId }).populate("userId", "name");
  const matched = memberships.filter((m) => {
    const user = m.userId as unknown as { _id: string; name: string };
    return names.includes(user.name.toLowerCase().replace(/\s+/g, ""));
  });
  return matched.map((m) => (m.userId as unknown as { _id: string })._id.toString());
}

export async function createComment(req: OrgScopedRequest, res: Response) {
  const ticketIdParam = req.params.ticketId;
  const ticketId = Array.isArray(ticketIdParam) ? ticketIdParam[0] : ticketIdParam;
  const { body } = req.body as { body?: string };
  if (!ticketId) return res.status(400).json({ message: "Ticket ID is required" });
  if (!body?.trim()) return res.status(400).json({ message: "Comment body is required" });

  const userId = req.userId;
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const orgId = req.membership!.orgId;
  const ticket = await Ticket.findOne({ _id: ticketId, orgId });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });

  const mentionedUserIds = await resolveMentions(body, orgId);

  const comment = await Comment.create({
    ticketId,
    orgId,
    authorId: userId,
    body,
    mentionedUserIds,
  });

  const notifyIds = new Set(mentionedUserIds);
  if (ticket.assigneeId && ticket.assigneeId.toString() !== userId) notifyIds.add(ticket.assigneeId.toString());
  notifyIds.delete(userId);

  const notifications = await Notification.insertMany(
    [...notifyIds].map((notifyUserId) => ({
      userId: notifyUserId,
      type: mentionedUserIds.includes(notifyUserId) ? "mention" : "assigned",
      ticketId,
      commentId: comment._id,
    }))
  );

  const io = getIO();
  io.to(`project:${ticket.projectId}`).emit("comment:created", comment);
  notifications.forEach((n) => io.to(`user:${n.userId}`).emit("notification:new", n));
  res.status(201).json({ comment });
}

export async function listComments(req: OrgScopedRequest, res: Response) {
  const ticketIdParam = req.params.ticketId;
  const ticketId = Array.isArray(ticketIdParam) ? ticketIdParam[0] : ticketIdParam;
  if (!ticketId) return res.status(400).json({ message: "Ticket ID is required" });

  const comments = await Comment.find({ ticketId, orgId: req.membership!.orgId })
    .populate("authorId", "name")
    .sort({ createdAt: 1 });
  res.json({ comments });
}