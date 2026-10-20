import { Ticket, STATUSES, PRIORITIES } from "../models/Ticket.js";
import { Project } from "../models/Project.js";
import type { Response } from "express";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";
import { invalidateAnalytics } from "../lib/cache.js";
import { getIO } from "../socket.js";
import { Membership } from "../models/Membership.js";
import { isObjectId } from "../middlewares/validateId.js";

async function isOrgMember(userId: string, orgId: string) {
  return (await Membership.exists({ userId, orgId })) !== null;
}

async function assertProjectInOrg(projectId:string, orgId:string) {
    const project = await Project.findOne({_id:projectId, orgId});
    return project !== null;
}

function isPriority(value: unknown): value is (typeof PRIORITIES)[number] {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export async function createTicket(req: OrgScopedRequest, res: Response) {
  const { projectId } = req.params as { projectId: string };
  const { title, description, priority, assigneeId, labels } = req.body as {
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    assigneeId?: unknown;
    labels?: unknown;
  };

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ message: "title must be at most 200 characters" });
  }
  if (!(await assertProjectInOrg(projectId, req.membership!.orgId))) {
    return res.status(404).json({ message: "Project not found in this organization" });
  }
  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ message: "description must be a string" });
  }
  if (typeof description === "string" && description.length > 5000) {
    return res.status(400).json({ message: "description must be at most 5000 characters" });
  }
  if (
    labels !== undefined &&
    (!Array.isArray(labels) || !labels.every((label) => typeof label === "string"))
  ) {
    return res.status(400).json({ message: "labels must be an array of strings" });
  }
  if (
    Array.isArray(labels) &&
    (labels.length > 10 || labels.some((label: string) => label.length > 30))
  ) {
    return res.status(400).json({ message: "labels: at most 10, each up to 30 characters" });
  }
  if (priority !== undefined && !isPriority(priority)) {
    return res.status(400).json({ message: `priority must be one of: ${PRIORITIES.join(", ")}` });
  }
  let normalizedAssigneeId: string | null = null;
  if (assigneeId !== undefined && assigneeId !== null) {
    if (
      typeof assigneeId !== "string" ||
      !isObjectId(assigneeId) ||
      !(await isOrgMember(assigneeId, req.membership!.orgId))
    ) {
      return res.status(400).json({ message: "Assignee must be a member of this organization" });
    }
    normalizedAssigneeId = assigneeId;
  }
  const ticket = await Ticket.create({
    orgId: req.membership!.orgId,
    projectId,
    title: title.trim(),
    description,
    priority,
    assigneeId: normalizedAssigneeId,
    labels,
    createdBy: req.userId,
  });
  await invalidateAnalytics(req.membership!.orgId);
  getIO().to(`project:${ticket.projectId}`).emit("ticket:created", ticket);
  res.status(201).json({ ticket });
}

export async function listTickets(req:OrgScopedRequest, res:Response) {
    const {projectId} = req.params;
    const tickets = await Ticket.find({orgId:req.membership!.orgId, projectId}).sort({createdAt:-1});
    res.json({tickets});
}

export async function updateTicket(req: OrgScopedRequest, res: Response) {
  const { ticketId } = req.params;
  const orgId = req.membership!.orgId;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return res.status(400).json({ message: "title must be a non-empty string" });
    }
    if (body.title.trim().length > 200) {
      return res.status(400).json({ message: "title must be at most 200 characters" });
    }
    updates.title = body.title.trim();
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      return res.status(400).json({ message: "description must be a string" });
    }
    if (body.description.length > 5000) {
      return res.status(400).json({ message: "description must be at most 5000 characters" });
    }
    updates.description = body.description;
  }

  if ("status" in body) {
    if (typeof body.status !== "string" || !(STATUSES as readonly string[]).includes(body.status)) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
    }
    updates.status = body.status;
  }

  if ("priority" in body) {
    if (typeof body.priority !== "string" || !(PRIORITIES as readonly string[]).includes(body.priority)) {
      return res.status(400).json({ message: `priority must be one of: ${PRIORITIES.join(", ")}` });
    }
    updates.priority = body.priority;
  }

  if ("labels" in body) {
    if (!Array.isArray(body.labels) || !body.labels.every((l) => typeof l === "string")) {
      return res.status(400).json({ message: "labels must be an array of strings" });
    }
    if (body.labels.length > 10 || body.labels.some((label) => label.length > 30)) {
      return res.status(400).json({ message: "labels: at most 10, each up to 30 characters" });
    }
    updates.labels = body.labels;
  }

  if ("assigneeId" in body) {
    if (body.assigneeId === null) updates.assigneeId = null;
    else if (isObjectId(body.assigneeId) && (await isOrgMember(body.assigneeId, orgId))) {
      updates.assigneeId = body.assigneeId;
    }
    else return res.status(400).json({ message: "Assignee must be a member of this organization" });
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid fields to update" });

  if (typeof updates.status === "string") {
    const current = await Ticket.findOne({ _id: ticketId, orgId }).select("status");
    if (!current) return res.status(404).json({ message: "Ticket not found" });
    if (updates.status === "done" && current.status !== "done") updates.completedAt = new Date();
    if (updates.status !== "done") updates.completedAt = null;
  }
  
  const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, orgId }, { $set: updates }, { new: true });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });

  await invalidateAnalytics(orgId);
  getIO().to(`project:${ticket.projectId}`).emit("ticket:updated", ticket);
  res.json({ ticket });
}

export async function deleteTicket(req: OrgScopedRequest, res: Response) {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOneAndDelete({ _id: ticketId, orgId: req.membership!.orgId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    await invalidateAnalytics(req.membership!.orgId);
    getIO().to(`project:${ticket.projectId}`).emit("ticket:deleted", { ticketId });
    res.json({ message: "Deleted" });
}