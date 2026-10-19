import type { Response } from "express";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { User } from "../models/User.js";
import type { AuthedRequest } from "../middlewares/auth.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";
import { roleRank } from "../middlewares/requireOrgMembership.js";
import { ROLES, type Role } from "../models/Membership.js";
import { Ticket } from "../models/Ticket.js";
import { Project } from "../models/Project.js";
import { invalidateAnalytics } from "../lib/cache.js";
import { getIO } from "../socket.js";

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

export async function changeMemberRole(req: OrgScopedRequest, res: Response) {
  const { memberId } = req.params;
  const { role } = (req.body ?? {}) as { role?: string };
  const orgId = req.membership!.orgId;
  const actorRank = roleRank[req.membership!.role];

  if (typeof role !== "string" || !isRole(role)) {
    return res.status(400).json({ message: `role must be one of: ${ROLES.join(", ")}` });
  }

  const target = await Membership.findOne({ _id: memberId, orgId });
  if (!target) return res.status(404).json({ message: "Member not found" });

  if (target.userId.toString() === req.userId) {
    return res.status(403).json({ message: "You can't change your own role" });
  }
  if (roleRank[target.role as Role] >= actorRank) {
    return res.status(403).json({ message: "You can only change the role of people ranked below you" });
  }
  if (roleRank[role] >= actorRank) {
    return res.status(403).json({ message: "You can only grant roles below your own" });
  }

  target.role = role;
  await target.save();
  res.json({ membership: target });
}

export async function removeMember(req: OrgScopedRequest, res: Response) {
  const { memberId } = req.params;
  const orgId = req.membership!.orgId;

  const target = await Membership.findOne({ _id: memberId, orgId });
  if (!target) return res.status(404).json({ message: "Member not found" });

  const isSelf = target.userId.toString() === req.userId;
  const targetRole = target.role as Role;

  if (targetRole === "owner") {
    return res.status(403).json({ message: "The owner can't be removed or leave" });
  }
  if (!isSelf) {
    if (roleRank[req.membership!.role] < roleRank.lead) {
      return res.status(403).json({ message: "Only leads and owners can remove members" });
    }
    if (roleRank[targetRole] >= roleRank[req.membership!.role]) {
      return res.status(403).json({ message: "You can only remove people ranked below you" });
    }
  }

  await target.deleteOne();

  await Ticket.updateMany({ orgId, assigneeId: target.userId }, { $set: { assigneeId: null } });
  await invalidateAnalytics(orgId);

  const projects = await Project.find({ orgId }).select("_id");
  getIO()
    .in(`user:${target.userId}`)
    .socketsLeave(projects.map((p) => `project:${p._id}`));

  res.json({ message: "Member removed" });
}