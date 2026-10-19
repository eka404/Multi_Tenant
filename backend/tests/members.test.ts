import request from "supertest";
import type { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Membership } from "../src/models/Membership.js";
import { Ticket } from "../src/models/Ticket.js";
import { addMember, asUser, createOrg, createProject } from "./factories.js";

async function setup() {
  const { org, owner } = await createOrg("Owner");
  const lead = await addMember(org._id, "lead", "Lead");
  const otherLead = await addMember(org._id, "lead", "Other Lead");
  const contributor = await addMember(org._id, "contributor", "Contributor");
  const guest = await addMember(org._id, "guest", "Guest");
  const membershipOf = (who: { user: { _id: Types.ObjectId } }) =>
    Membership.findOne({ userId: who.user._id, orgId: org._id });
  const url = (membershipId: unknown) => `/api/orgs/${org._id}/members/${membershipId}`;
  return { org, owner, lead, otherLead, contributor, guest, membershipOf, url };
}

describe("changing roles", () => {
  it("lets a lead move a contributor down to guest", async () => {
    const { lead, contributor, membershipOf, url } = await setup();
    const target = await membershipOf(contributor);
    const res = await request(app).patch(url(target!._id)).set(asUser(lead)).send({ role: "guest" });

    expect(res.status).toBe(200);
    expect((await membershipOf(contributor))?.role).toBe("guest");
  });

  it("never lets someone grant a role at or above their own", async () => {
    const { lead, contributor, membershipOf, url } = await setup();
    const target = await membershipOf(contributor);
    const res = await request(app).patch(url(target!._id)).set(asUser(lead)).send({ role: "lead" });

    expect(res.status).toBe(403);
    expect((await membershipOf(contributor))?.role).toBe("contributor");
  });

  it("doesn't let a lead change another lead or the owner", async () => {
    const { lead, otherLead, owner, membershipOf, url } = await setup();
    const otherLeadMembership = await membershipOf(otherLead);
    const ownerMembership = await membershipOf(owner);
    const demoteLead = await request(app).patch(url(otherLeadMembership!._id)).set(asUser(lead)).send({ role: "guest" });
    const demoteOwner = await request(app).patch(url(ownerMembership!._id)).set(asUser(lead)).send({ role: "guest" });

    expect(demoteLead.status).toBe(403);
    expect(demoteOwner.status).toBe(403);
    expect((await membershipOf(owner))?.role).toBe("owner");
  });

  it("doesn't let people change their own role", async () => {
    const { lead, membershipOf, url } = await setup();
    const own = await membershipOf(lead);
    const res = await request(app).patch(url(own!._id)).set(asUser(lead)).send({ role: "contributor" });

    expect(res.status).toBe(403);
  });

  it("lets the owner promote a contributor to lead", async () => {
    const { owner, contributor, membershipOf, url } = await setup();
    const target = await membershipOf(contributor);
    const res = await request(app).patch(url(target!._id)).set(asUser(owner)).send({ role: "lead" });

    expect(res.status).toBe(200);
    expect((await membershipOf(contributor))?.role).toBe("lead");
  });

  it("keeps contributors from changing roles at all", async () => {
    const { contributor, guest, membershipOf, url } = await setup();
    const target = await membershipOf(guest);
    const res = await request(app).patch(url(target!._id)).set(asUser(contributor)).send({ role: "contributor" });

    expect(res.status).toBe(403);
  });

  it("rejects an invalid role", async () => {
    const { owner, contributor, membershipOf, url } = await setup();
    const target = await membershipOf(contributor);
    const res = await request(app).patch(url(target!._id)).set(asUser(owner)).send({ role: "emperor" });

    expect(res.status).toBe(400);
  });

  it("can't reach another organization's memberships through your own", async () => {
    const { lead, url } = await setup();
    const other = await createOrg("Bob");
    const bobMembership = await Membership.findOne({ userId: other.owner.user._id, orgId: other.org._id });
    const res = await request(app).patch(url(bobMembership!._id)).set(asUser(lead)).send({ role: "guest" });

    expect(res.status).toBe(404);
    expect((await Membership.findById(bobMembership!._id))?.role).toBe("owner");
  });
});

describe("removing and leaving", () => {
  it("lets a lead remove a contributor, unassigns their tickets and cuts off their access", async () => {
    const { org, owner, lead, contributor, membershipOf, url } = await setup();
    const project = await createProject(org._id, owner.user._id);
    const ticket = await Ticket.create({
      orgId: org._id,
      projectId: project._id,
      title: "Assigned work",
      assigneeId: contributor.user._id,
      createdBy: owner.user._id,
    });
    const target = await membershipOf(contributor);
    const res = await request(app).delete(url(target!._id)).set(asUser(lead));

    expect(res.status).toBe(200);
    expect(await membershipOf(contributor)).toBeNull();
    expect((await Ticket.findById(ticket._id))?.assigneeId).toBeNull();

    const afterwards = await request(app).get(`/api/orgs/${org._id}/members`).set(asUser(contributor));
    expect(afterwards.status).toBe(403);
  });

  it("doesn't let a lead remove the owner or another lead", async () => {
    const { lead, otherLead, owner, membershipOf, url } = await setup();
    const otherLeadMembership = await membershipOf(otherLead);
    const ownerMembership = await membershipOf(owner);
    const removeLead = await request(app).delete(url(otherLeadMembership!._id)).set(asUser(lead));
    const removeOwner = await request(app).delete(url(ownerMembership!._id)).set(asUser(lead));

    expect(removeLead.status).toBe(403);
    expect(removeOwner.status).toBe(403);
  });

  it("doesn't let contributors remove other people", async () => {
    const { contributor, guest, membershipOf, url } = await setup();
    const target = await membershipOf(guest);
    const res = await request(app).delete(url(target!._id)).set(asUser(contributor));

    expect(res.status).toBe(403);
    expect(await membershipOf(guest)).not.toBeNull();
  });

  it("lets a non-owner leave the organization", async () => {
    const { contributor, membershipOf, url } = await setup();
    const own = await membershipOf(contributor);
    const res = await request(app).delete(url(own!._id)).set(asUser(contributor));

    expect(res.status).toBe(200);
    expect(await membershipOf(contributor)).toBeNull();
  });

  it("doesn't let the owner leave", async () => {
    const { owner, membershipOf, url } = await setup();
    const own = await membershipOf(owner);
    const res = await request(app).delete(url(own!._id)).set(asUser(owner));

    expect(res.status).toBe(403);
  });

  it("rejects a malformed membership id", async () => {
    const { owner, url } = await setup();
    const res = await request(app).delete(url("not-an-id")).set(asUser(owner));
    expect(res.status).toBe(400);
  });
});