import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { asUser, createOrg, createProject } from "./factories.js";
import { redis } from "../src/config/redis.js";
import { cached } from "../src/lib/cache.js";

describe.skipIf(!redis)("analytics cache", () => {
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

    await make(projectA._id, "second");
    expect((await get()).body.totals.tickets).toBe(1);

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

describe("request coalescing", () => {
  it("shares one computation between concurrent callers", async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "value";
    };
    const key = `test:coalesce:${Math.random()}`;

    const results = await Promise.all([cached(key, 60, load), cached(key, 60, load), cached(key, 60, load)]);

    expect(results).toEqual(["value", "value", "value"]);
    expect(calls).toBe(1);
  });
});