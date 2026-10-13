import request from "supertest";
import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { addMember, asUser, createOrg, createProject } from "./factories.js";

const DAY_MS = 24 * 60 * 60 * 1000;
type Status = "todo" | "in_progress" | "review" | "done";

async function setup() {
  const { org, owner } = await createOrg("Owner");
  const project = await createProject(org._id, owner.user._id);
  const make = (title: string, status: Status = "todo", assigneeId: Types.ObjectId | null = null) =>
    Ticket.create({ orgId: org._id, projectId: project._id, title, status, assigneeId, createdBy: owner.user._id });
  return { org, owner, project, make, url: `/api/orgs/${org._id}/analytics` };
}

describe("analytics", () => {
  it("counts tickets by status and splits open from done", async () => {
    const { owner, make, url } = await setup();
    await make("a");
    await make("b");
    await make("c", "in_progress");
    await make("d", "done");

    const res = await request(app).get(url).set(asUser(owner));

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ tickets: 4, open: 3, done: 1 });
    expect(res.body.byStatus.find((r: { status: string }) => r.status === "todo").count).toBe(2);
  });

  it("only counts the caller's own organization", async () => {
    const a = await setup();
    const b = await setup();
    await a.make("mine");
    await b.make("theirs 1");
    await b.make("theirs 2");

    const res = await request(app).get(a.url).set(asUser(a.owner));

    expect(res.body.totals.tickets).toBe(1);
  });

  it("is limited to leads and owners", async () => {
    const { org, url } = await setup();
    const lead = await addMember(org._id, "lead", "Lead");
    const contributor = await addMember(org._id, "contributor", "Contributor");

    const asLead = await request(app).get(url).set(asUser(lead));
    const asContributor = await request(app).get(url).set(asUser(contributor));

    expect(asLead.status).toBe(200);
    expect(asContributor.status).toBe(403);
  });

  it("returns one zero-filled bucket per week", async () => {
    const { owner, make, url } = await setup();
    await make("a");
    await make("b");

    const res = await request(app).get(url).query({ weeks: 4 }).set(asUser(owner));
    const counts = res.body.createdPerWeek.map((w: { count: number }) => w.count);

    expect(counts).toEqual([0, 0, 0, 2]);
  });

  it("computes average cycle time from creation to completion", async () => {
    const { owner, make, url } = await setup();
    const ticket = await make("shipped", "done");
    const now = new Date();
    await Ticket.collection.updateOne(
      { _id: ticket._id },
      { $set: { createdAt: new Date(now.getTime() - 4 * DAY_MS), completedAt: now } }
    );

    const res = await request(app).get(url).set(asUser(owner));

    expect(res.body.avgCycleDays).toBe(4);
  });

  it("stamps completedAt when a ticket moves to done and clears it when it moves out", async () => {
    const { org, owner, make } = await setup();
    const ticket = await make("moving");
    const patch = (status: string) =>
      request(app).patch(`/api/orgs/${org._id}/tickets/${ticket._id}`).set(asUser(owner)).send({ status });

    await patch("done");
    expect((await Ticket.findById(ticket._id))?.completedAt).toBeInstanceOf(Date);

    await patch("todo");
    expect((await Ticket.findById(ticket._id))?.completedAt).toBeNull();
  });

  it("groups open work by assignee and labels unassigned tickets", async () => {
    const { owner, make, url } = await setup();
    await make("assigned", "todo", owner.user._id);
    await make("nobody's");

    const res = await request(app).get(url).set(asUser(owner));
    const names = res.body.workload.map((w: { name: string }) => w.name).sort();

    expect(names).toEqual(["Owner", "Unassigned"]);
  });

  it("validates its query parameters", async () => {
    const { owner, url } = await setup();

    const badProject = await request(app).get(url).query({ projectId: "nope" }).set(asUser(owner));
    const badWeeks = await request(app).get(url).query({ weeks: "abc" }).set(asUser(owner));

    expect(badProject.status).toBe(400);
    expect(badWeeks.status).toBe(200);
    expect(badWeeks.body.createdPerWeek).toHaveLength(8);
  });
});