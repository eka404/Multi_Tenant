import type { Response } from "express";
import { Ticket } from "../models/Ticket.js";
import { isObjectId } from "../middlewares/validateId.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";

export async function searchTickets(req: OrgScopedRequest, res: Response) {
  const { q, projectId } = req.query;

  if (typeof q !== "string" || q.trim().length < 2 || q.length > 100) {
    return res.status(400).json({ message: "q must be 2 to 100 characters" });
  }
  if (projectId !== undefined && !isObjectId(projectId)) return res.status(400).json({ message: "Invalid projectId" });
  
  const tickets = await Ticket.find(
    {
      orgId: req.membership!.orgId,
      ...(projectId ? { projectId } : {}),
      $text: { $search: q.trim() },
    },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(50);

  res.json({ tickets });
}