import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { asUser, createOrg, createProject } from "./factories.js";

async function setupTwoOrgs() {
  const a = await createOrg("Alice");
  const b = await createOrg("Bob");
  const projectB = await createProject(b.org._id, b.owner.user._id);
  const ticketB = await Ticket.create({
    orgId: b.org._id,
    projectId: projectB._id,
    title: "Secret roadmap",
    createdBy: b.owner.user._id,
  });
  return { a, b, projectB, ticketB };
}

describe("tenant isolation", () => {
  it("blocks reading another org's members", async () => {
    const { a, b } = await setupTwoOrgs();
    const res = await request(app).get(`/api/orgs/${b.org._id}/members`).set(asUser(a.owner));
    expect(res.status).toBe(403);
  });

  it("returns no tickets when another org's project is requested through your own org", async () => {
    const { a, projectB } = await setupTwoOrgs();
    const res = await request(app)
      .get(`/api/orgs/${a.org._id}/projects/${projectB._id}/tickets`)
      .set(asUser(a.owner));
    expect(res.status).toBe(200);
    expect(res.body.tickets).toEqual([]);
  });

  it("cannot edit another org's ticket through your own org", async () => {
    const { a, ticketB } = await setupTwoOrgs();
    const res = await request(app)
      .patch(`/api/orgs/${a.org._id}/tickets/${ticketB._id}`)
      .set(asUser(a.owner))
      .send({ title: "hacked" });

    expect(res.status).toBe(404);
    const saved = await Ticket.findById(ticketB._id);
    expect(saved?.title).toBe("Secret roadmap");
  });

  it("cannot create a ticket in another org's project", async () => {
    const { a, projectB } = await setupTwoOrgs();
    const res = await request(app)
      .post(`/api/orgs/${a.org._id}/projects/${projectB._id}/tickets`)
      .set(asUser(a.owner))
      .send({ title: "planted ticket" });
    expect(res.status).toBe(404);
    expect(await Ticket.countDocuments({ projectId: projectB._id })).toBe(1);
  });
});
