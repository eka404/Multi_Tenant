import type { Response } from "express";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { User } from "../models/User.js";
import type { AuthedRequest } from "../middlewares/auth.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";
import { roleRank } from "../middlewares/requireOrgMembership.js";
import { ROLES, type Role } from "../models/Membership.js";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function createOrg(req: AuthedRequest, res: Response){
    const {name} = req.body as {name?:string};
    if(!name) return res.status(400).json({message: "Organization name is required"});

    const org  = await Organization.create({name, ownerId: req.userId});
    await Membership.create({userId:req.userId, orgId: org._id, role: "owner"});
    res.status(201).json({org});
}

export async function listMyOrgs(req: AuthedRequest, res: Response) {
  const memberships = await Membership.find({ userId: req.userId }).populate("orgId");
  res.json({ organizations: memberships.map((m) => m.orgId) });
}

export async function inviteMember(req: OrgScopedRequest, res: Response){
    const {email,role} = req.body as {email?:string, role?:string};
    if(!email || !role) return res.status(400).json({ message: "email and role are required" });

    if(!isRole(role)) return res.status(400).json({ message: `role must be one of: ${ROLES.join(", ")}` });
    if (roleRank[role] >= roleRank[req.membership!.role]) {
        return res.status(403).json({ message: "You can only grant roles below your own" });
    }

    const user = await User.findOne({email:email.toLowerCase().trim()});
    if(!user) return res.status(404).json({message: "No registered user with that email"});

    const existing = await Membership.findOne({userId: user._id, orgId: req.membership!.orgId});
    if(existing) return res.status(409).json({message: "User is already a member"});

    const membership = await Membership.create({
        userId: user._id,
        orgId: req.membership!.orgId,
        role: role
    });
    res.status(201).json({membership});
}

export async function listMembers(req:OrgScopedRequest, res:Response) {
    const members = await Membership.find({orgId:req.membership!.orgId}).populate("userId", "name email");
    res.json({members});
}