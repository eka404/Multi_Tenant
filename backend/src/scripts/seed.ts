import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { Project } from "../models/Project.js";
import { Ticket } from "../models/Ticket.js";

const PASSWORD = "demo-password-123";

const tickets = [
  ["Design the new landing page hero", "done", "medium"],
  ["Set up CI for the marketing site", "done", "low"],
  ["Fix navbar overlap on mobile", "review", "high"],
  ["Write copy for the pricing page", "review", "medium"],
  ["Add dark mode toggle", "in_progress", "medium"],
  ["Optimize hero image loading", "in_progress", "high"],
  ["Add analytics events to signup flow", "todo", "low"],
  ["Checkout page crashes on Safari", "todo", "urgent"],
] as const;

async function main() {
  await mongoose.connect(env.mongoUri);

  if (await User.exists({ email: "demo.owner@example.com" })) {
    console.log("Demo data already exists, nothing to do");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const owner = await User.create({ name: "Demo Owner", email: "demo.owner@example.com", passwordHash });
  const dev = await User.create({ name: "Demo Dev", email: "demo.dev@example.com", passwordHash });

  const org = await Organization.create({ name: "Demo Studio", ownerId: owner._id });
  await Membership.create([
    { userId: owner._id, orgId: org._id, role: "owner" },
    { userId: dev._id, orgId: org._id, role: "contributor" },
  ]);

  const project = await Project.create({ orgId: org._id, name: "Website Revamp", createdBy: owner._id });
  await Ticket.insertMany(
    tickets.map(([title, status, priority], i) => ({
      orgId: org._id,
      projectId: project._id,
      title,
      status,
      priority,
      assigneeId: i % 2 === 0 ? dev._id : owner._id,
      createdBy: owner._id,
    }))
  );

  console.log("Seeded demo users, organization, project and tickets");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());