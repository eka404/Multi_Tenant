import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { Membership } from "../models/Membership.js";
import { Project } from "../models/Project.js";
import { Ticket, STATUSES, PRIORITIES } from "../models/Ticket.js";

const COUNT = Number(process.argv[2]) || 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL = "loadtest@example.com";
const PASSWORD = "loadtest-password";

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  await mongoose.connect(env.mongoUri);

  if (!/bench|test/i.test(mongoose.connection.name)) {
    throw new Error(
      `Refusing to write fake tickets into "${mongoose.connection.name}": the database name must contain "bench" or "test"`
    );
  }
  if (await User.exists({ email: EMAIL })) {
    console.log(
      "Load-test data already exists. To start over:\n" +
        "docker exec mongo-test mongosh issue-tracker-bench --eval 'db.dropDatabase()'"
    );
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const owner = await User.create({ name: "Load Owner", email: EMAIL, passwordHash });
  const [dev1, dev2] = await User.create([
    { name: "Load Dev One", email: "loaddev1@example.com", passwordHash },
    { name: "Load Dev Two", email: "loaddev2@example.com", passwordHash },
  ]);

  const org = await Organization.create({ name: "Load Test Org", ownerId: owner._id });
  await Membership.create([
    { userId: owner._id, orgId: org._id, role: "owner" },
    { userId: dev1._id, orgId: org._id, role: "contributor" },
    { userId: dev2._id, orgId: org._id, role: "contributor" },
  ]);
  const project = await Project.create({ orgId: org._id, name: "Big Project", createdBy: owner._id });

  const people = [owner._id, dev1._id, dev2._id];
  const now = Date.now();
  const batchSize = 5000;

  for (let start = 0; start < COUNT; start += batchSize) {
    const size = Math.min(batchSize, COUNT - start);
    const docs = Array.from({ length: size }, (_, i) => {
      const createdAt = new Date(now - Math.random() * 8 * 7 * DAY_MS);
      const status = pick(STATUSES);
      return {
        orgId: org._id,
        projectId: project._id,
        title: `Load test ticket ${start + i + 1}`,
        description: "",
        status,
        priority: pick(PRIORITIES),
        assigneeId: Math.random() < 0.2 ? null : pick(people),
        labels: [],
        completedAt:
          status === "done" ? new Date(Math.min(now, createdAt.getTime() + Math.random() * 10 * DAY_MS)) : null,
        createdBy: owner._id,
        createdAt,
        updatedAt: createdAt,
      };
    });
    await Ticket.collection.insertMany(docs);
    console.log(`Inserted ${start + size} / ${COUNT}`);
  }

  const sample = await Ticket.findOne({ orgId: org._id });
  console.log(`
Loaded ${COUNT} tickets. From the repo root, run the benchmark with:

docker run --rm -i --network host grafana/k6 run -e ORG_ID=${org._id} -e TICKET_ID=${sample?._id} - < loadtest/analytics.js
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());