import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";
import { env } from "../src/config/env.js";
import { Membership, type Role } from "../src/models/Membership.js";
import { Organization } from "../src/models/Organization.js";
import { Project } from "../src/models/Project.js";
import { User } from "../src/models/User.js";

export async function createUser(name = "Test User") {
  const slug = name.toLowerCase().replace(/\s+/g, "");
  const email = `${slug}-${randomUUID()}@example.com`;
  const user = await User.create({ name, email, passwordHash: "not-a-real-hash" });
  const token = jwt.sign({ userId: user._id.toString() }, env.jwtAccessSecret, { expiresIn: "15m" });
  return { user, token, auth: `Bearer ${token}` };
}

export const asUser = (user: { auth: string }) => ({ Authorization: user.auth });

export async function createOrg(ownerName = "Owner") {
  const owner = await createUser(ownerName);
  const org = await Organization.create({ name: "Acme", ownerId: owner.user._id });
  await Membership.create({ userId: owner.user._id, orgId: org._id, role: "owner" });
  return { org, owner };
}

export async function addMember(orgId: Types.ObjectId, role: Role, name: string) {
  const member = await createUser(name);
  await Membership.create({ userId: member.user._id, orgId, role });
  return member;
}

export function createProject(orgId: Types.ObjectId, createdBy: Types.ObjectId) {
  return Project.create({ orgId, name: "Website", createdBy });
}
