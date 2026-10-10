import { Ticket, STATUSES, PRIORITIES } from "../models/Ticket.js";
import { Project } from "../models/Project.js";
import type { Response } from "express";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";
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

export async function createTicket(req:OrgScopedRequest, res:Response) {
    const {projectId} = req.params as { projectId: string };
    const {title, description, priority, assigneeId, labels} = req.body as {
        title?: string;
        description?: string;
        priority?: string;
        assigneeId?: string;
        labels?: string[];
    }

    if(!title) return res.status(400).json({message: "Title is required"});
    if(!(await assertProjectInOrg(projectId, req.membership!.orgId))){
        return res.status(404).json({message: "Project not found in this organization"});
    }
    if(priority && !(PRIORITIES as readonly string[]).includes(priority)){
        return res.status(400).json({message: `priority must be one of: ${PRIORITIES.join(", ")}`});
    }
    if (assigneeId && !(isObjectId(assigneeId) && (await isOrgMember(assigneeId, req.membership!.orgId)))) {
        return res.status(400).json({ message: "Assignee must be a member of this organization" });
    }

    const normalizedPriority = priority && (PRIORITIES as readonly string[]).includes(priority)
        ? (priority as (typeof PRIORITIES)[number]) : undefined;

    const ticket = await Ticket.create({
        orgId: req.membership!.orgId,
        projectId,
        title,
        description,
        priority: normalizedPriority,
        assigneeId: assigneeId || null,
        labels,
        createdBy: req.userId,
    });
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
    updates.title = body.title.trim();
  }

  if ("description" in body) {
    if (typeof body.description !== "string") return res.status(400).json({ message: "description must be a string" });
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

  const ticket = await Ticket.findOneAndUpdate({ _id: ticketId, orgId }, { $set: updates }, { new: true });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });

  getIO().to(`project:${ticket.projectId}`).emit("ticket:updated", ticket);
  res.json({ ticket });
}

export async function deleteTicket(req: OrgScopedRequest, res: Response) {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOneAndDelete({ _id: ticketId, orgId: req.membership!.orgId });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    getIO().to(`project:${ticket.projectId}`).emit("ticket:deleted", { ticketId });
    res.json({ message: "Deleted" });
}