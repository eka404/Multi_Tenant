import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { Project } from "../models/Project.js";
import { Ticket } from "../models/Ticket.js";
import { Comment } from "../models/Comment.js";
import { Notification } from "../models/Notification.js";

const PASSWORD = "demo-password-123";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_EMAILS = ["demo.owner@example.com", "demo.dev@example.com"];

const tickets = [
  ["Checkout page crashes on Safari", "todo", "urgent"],
  ["Design the new landing page hero", "done", "high"],
  ["Optimize hero image loading", "in_progress", "high"],
  ["Migrate blog to the new CMS", "done", "medium"],
  ["Add dark mode toggle", "in_progress", "medium"],
  ["Fix navbar overlap on mobile", "review", "high"],
  ["Compress image assets", "done", "low"],
  ["Write copy for the pricing page", "review", "medium"],
  ["Fix broken footer links", "done", "low"],
  ["Set up CI for the marketing site", "done", "medium"],
  ["Add analytics events to signup flow", "todo", "low"],
  ["Add favicon and meta tags", "done", "low"],
] as const;

async function reset() {
  const users = await User.find({ email: { $in: DEMO_EMAILS } }).select("_id");
  const userIds = users.map((u) => u._id);
  const orgs = await Organization.find({ ownerId: { $in: userIds } }).select("_id");
  const orgIds = orgs.map((o) => o._id);

  await Promise.all([
    Comment.deleteMany({ orgId: { $in: orgIds } }),
    Ticket.deleteMany({ orgId: { $in: orgIds } }),
    Project.deleteMany({ orgId: { $in: orgIds } }),
    Membership.deleteMany({ orgId: { $in: orgIds } }),
    Notification.deleteMany({ userId: { $in: userIds } }),
    Organization.deleteMany({ _id: { $in: orgIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
}

async function main() {
  await mongoose.connect(env.mongoUri);

  if (process.argv.includes("--reset")) {
    await reset();
    console.log("Removed existing demo data");
  }

  if (await User.exists({ email: DEMO_EMAILS[0] })) {
    console.log("Demo data already exists, nothing to do (use --reset to rebuild it)");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const owner = await User.create({ name: "Demo Owner", email: DEMO_EMAILS[0], passwordHash });
  const dev = await User.create({ name: "Demo Dev", email: DEMO_EMAILS[1], passwordHash });

  const org = await Organization.create({ name: "Demo Studio", ownerId: owner._id });
  await Membership.create([
    { userId: owner._id, orgId: org._id, role: "owner" },
    { userId: dev._id, orgId: org._id, role: "contributor" },
  ]);

  const project = await Project.create({ orgId: org._id, name: "Website Revamp", createdBy: owner._id });
  const created = await Ticket.insertMany(
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

  await Promise.all(
    created.map((t, i) => {
      const createdAt = new Date(Date.now() - (i * 3 + 2) * DAY_MS);
      const completedAt = t.status === "done" ? new Date(createdAt.getTime() + (2 + (i % 4)) * DAY_MS) : null;
      return Ticket.collection.updateOne({ _id: t._id }, { $set: { createdAt, completedAt } });
    })
  );
  console.log("Seeded demo users, organization, project and tickets");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());