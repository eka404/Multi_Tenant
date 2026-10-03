import { Ticket, STATUSES, PRIORITIES } from "../models/Ticket.js";
import { Project } from "../models/Project.js";
import type { Response } from "express";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";

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
        return res.status(401).json({message: "Project not found in this organization"});
    }
    if(priority && !(PRIORITIES as readonly string[]).includes(priority)){
        return res.status(400).json({message: `priority must be one of: ${PRIORITIES.join(", ")}`});
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
    res.status(201).json({ ticket });
}

export async function listTickets(req:OrgScopedRequest, res:Response) {
    const {projectId} = req.params;
    const tickets = await Ticket.find({orgId:req.membership!.orgId, projectId}).sort({createdAt:-1});
    res.json({tickets});
}

export async function updateTicket(req:OrgScopedRequest, res:Response) {
    const {ticketId} = req.params;
    const updates = req.body as Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        assigneeId: string | null;
        labels: string[];
    }>;

    if(updates.status && !(STATUSES as readonly string[]).includes(updates.status)){
        return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const ticket = await Ticket.findOneAndUpdate(
        {_id:ticketId, orgId:req.membership!.orgId},
        {$set: updates},
        {new:true}
    );
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json({ticket});
}

export async function deleteTicket(req: OrgScopedRequest, res: Response) {
  const { ticketId } = req.params;
  const ticket = await Ticket.findOneAndDelete({ _id: ticketId, orgId: req.membership!.orgId });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  res.json({ message: "Deleted" });
}