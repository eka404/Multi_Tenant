import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { addMember, asUser, createOrg, createProject, createUser } from "./factories.js";

async function setup() {
  const { org, owner } = await createOrg("Owner");
  const lead = await addMember(org._id, "lead", "Lead");
  const contributor = await addMember(org._id, "contributor", "Contributor");
  const guest = await addMember(org._id, "guest", "Guest");
  const project = await createProject(org._id, owner.user._id);
  const ticketsUrl = `/api/orgs/${org._id}/projects/${project._id}/tickets`;
  return { org, owner, lead, contributor, guest, project, ticketsUrl };
}

async function setupWithTicket() {
  const ctx = await setup();
  const ticket = await Ticket.create({
    orgId: ctx.org._id,
    projectId: ctx.project._id,
    title: "Original",
    createdBy: ctx.owner.user._id,
  });
  return { ...ctx, ticket, url: `/api/orgs/${ctx.org._id}/tickets/${ticket._id}` };
}

describe("permissions", () => {
  it("lets guests read tickets but not create them", async () => {
    const { guest, ticketsUrl } = await setup();
    const read = await request(app).get(ticketsUrl).set(asUser(guest));
    const write = await request(app).post(ticketsUrl).set(asUser(guest)).send({ title: "Nope" });
    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
  });

  it("lets contributors create tickets, but only leads delete them", async () => {
    const { org, contributor, lead, ticketsUrl } = await setup();
    const created = await request(app).post(ticketsUrl).set(asUser(contributor)).send({ title: "Fix navbar" });
    expect(created.status).toBe(201);

    const deleteUrl = `/api/orgs/${org._id}/tickets/${created.body.ticket._id}`;
    const byContributor = await request(app).delete(deleteUrl).set(asUser(contributor));
    const byLead = await request(app).delete(deleteUrl).set(asUser(lead));
    expect(byContributor.status).toBe(403);
    expect(byLead.status).toBe(200);
  });

  it("lets only leads and above create projects", async () => {
    const { org, contributor, lead } = await setup();
    const url = `/api/orgs/${org._id}/projects`;
    const byContributor = await request(app).post(url).set(asUser(contributor)).send({ name: "New" });
    const byLead = await request(app).post(url).set(asUser(lead)).send({ name: "New" });
    expect(byContributor.status).toBe(403);
    expect(byLead.status).toBe(201);
  });
});

describe("invites", () => {
  it("lets a lead invite a contributor but never an owner", async () => {
    const { org, lead } = await setup();
    const newcomer = await createUser("Newcomer");
    const url = `/api/orgs/${org._id}/invite`;

    const asOwner = await request(app)
      .post(url)
      .set(asUser(lead))
      .send({ email: newcomer.user.email, role: "owner" });
    const asContributor = await request(app)
      .post(url)
      .set(asUser(lead))
      .send({ email: newcomer.user.email, role: "contributor" });
    expect(asOwner.status).toBe(403);
    expect(asContributor.status).toBe(201);
  });

  it("stops contributors from inviting anyone", async () => {
    const { org, contributor } = await setup();
    const newcomer = await createUser("Newcomer");
    const res = await request(app)
      .post(`/api/orgs/${org._id}/invite`)
      .set(asUser(contributor))
      .send({ email: newcomer.user.email, role: "guest" });
    expect(res.status).toBe(403);
  });
});

describe("ticket updates", () => {
  it("ignores fields that aren't editable, like orgId", async () => {
    const { org, contributor, ticket, url } = await setupWithTicket();
    const res = await request(app)
      .patch(url)
      .set(asUser(contributor))
      .send({ title: "Renamed", orgId: new Types.ObjectId().toString() });

    expect(res.status).toBe(200);
    const saved = await Ticket.findById(ticket._id);
    expect(saved?.title).toBe("Renamed");
    expect(saved?.orgId.toString()).toBe(org._id.toString());
  });

  it("rejects an update with no editable fields", async () => {
    const { contributor, url } = await setupWithTicket();
    const res = await request(app)
      .patch(url)
      .set(asUser(contributor))
      .send({ orgId: new Types.ObjectId().toString() });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status", async () => {
    const { contributor, url } = await setupWithTicket();
    const res = await request(app).patch(url).set(asUser(contributor)).send({ status: "banana" });
    expect(res.status).toBe(400);
  });

  it("rejects assigning a ticket to someone outside the org", async () => {
    const { contributor, url } = await setupWithTicket();
    const outsider = await createUser("Outsider");
    const res = await request(app)
      .patch(url)
      .set(asUser(contributor))
      .send({ assigneeId: outsider.user._id.toString() });
    expect(res.status).toBe(400);
  });

  it("accepts assigning a ticket to an org member", async () => {
    const { contributor, url } = await setupWithTicket();
    const res = await request(app)
      .patch(url)
      .set(asUser(contributor))
      .send({ assigneeId: contributor.user._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.ticket.assigneeId).toBe(contributor.user._id.toString());
  });
});

describe("input validation", () => {
  it("returns 400 for a malformed id instead of crashing", async () => {
    const { owner } = await setup();
    const res = await request(app).get("/api/orgs/not-an-id/members").set(asUser(owner));
    expect(res.status).toBe(400);
  });
});
