import type { Response, NextFunction } from "express";
import { Membership, type Role } from "../models/Membership.js";
import type { AuthedRequest } from "./auth.js";

export interface OrgScopedRequest extends AuthedRequest {
  membership?: { orgId: string; role: Role };
}

export const roleRank: Record<Role, number> = {guest: 0, contributor: 1, lead: 2, owner: 3};

export function requireOrgMembership(minRole: Role = "guest") {
  return async (req: OrgScopedRequest, res: Response, next: NextFunction) => {
    const orgId = req.params.orgId;
    if(!orgId || Array.isArray(orgId)) return res.status(400).json({ message: "orgId is required in the URL" });

    const membership = await Membership.findOne({ userId: req.userId, orgId });
    if (!membership) return res.status(403).json({ message: "Not a member of this organization" });

    if (roleRank[membership.role as Role] < roleRank[minRole]) {
      return res.status(403).json({ message: "Insufficient role for this action" });
    }

    req.membership = { orgId, role: membership.role as Role };
    next();
  };
}