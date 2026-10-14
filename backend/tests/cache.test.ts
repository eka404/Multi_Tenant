import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { asUser, createOrg, createProject } from "./factories.js";

// these need a real Redis: run with TEST_REDIS_URL=redis://127.0.0.1:6379
describe.skipIf(!process.env.TEST_REDIS_URL)("analytics cache", () => {
  async function setup() {
    const { org, owner } = await createOrg("Owner");
    const projectA = await createProject(org._id, owner.user._id);
    const projectB = await createProject(org._id, owner.user._id);
    const make = (projectId: typeof projectA._id, title: string) =>
      Ticket.create({ orgId: org._id, projectId, title, createdBy: owner.user._id });
    const get = (query: Record<string, string> = {}) =>
      request(app).get(`/api/orgs/${org._id}/analytics`).query(query).set(asUser(owner));
    return { org, owner, projectA, projectB, make, get };
  }

  it("serves repeat requests from the cache until a ticket changes through the API", async () => {
    const { org, owner, projectA, make, get } = await setup();
    const first = await make(projectA._id, "first");

    expect((await get()).body.totals.tickets).toBe(1);

    // a write that bypasses the API can't invalidate the cache, so the old numbers are still served
    await make(projectA._id, "second");
    expect((await get()).body.totals.tickets).toBe(1);

    // a write through the API bumps the organization's cache version, so the next read is fresh
    await request(app)
      .patch(`/api/orgs/${org._id}/tickets/${first._id}`)
      .set(asUser(owner))
      .send({ title: "renamed" });
    expect((await get()).body.totals.tickets).toBe(2);
  });

  it("caches each project filter separately", async () => {
    const { projectA, projectB, make, get } = await setup();
    await make(projectA._id, "in a");
    await make(projectB._id, "in b");

    expect((await get()).body.totals.tickets).toBe(2);
    expect((await get({ projectId: projectA._id.toString() })).body.totals.tickets).toBe(1);
  });
});
