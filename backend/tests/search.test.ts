import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { addMember, asUser, createOrg, createProject } from "./factories.js";

async function setup() {
  const { org, owner } = await createOrg("Owner");
  const project = await createProject(org._id, owner.user._id);
  const make = (title: string, description = "", projectId = project._id) =>{
    Ticket.create({ orgId: org._id, projectId, title, description, createdBy: owner.user._id });
  }
  const searchUrl = `/api/orgs/${org._id}/search/tickets`;
  return { org, owner, project, make, searchUrl };
}

const titles = (res: { body: { tickets: { title: string }[] } }) =>
  res.body.tickets.map((t) => t.title);

describe("ticket search", () => {
  it("finds tickets by a word in the title or description, best match first", async () => {
    const { owner, make, searchUrl } = await setup();
    await make("Update footer", "the navbar links need work");
    await make("Fix navbar overlap");
    await make("Write pricing copy");

    const res = await request(app).get(searchUrl).query({ q: "navbar" }).set(asUser(owner));

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(["Fix navbar overlap", "Update footer"]);
  });

  it("only searches inside the caller's own organization", async () => {
    const a = await setup();
    const b = await setup();
    await a.make("Public navbar fix");
    await b.make("Secret navbar roadmap");

    const res = await request(app).get(a.searchUrl).query({ q: "navbar" }).set(asUser(a.owner));

    expect(titles(res)).toEqual(["Public navbar fix"]);
  });

  it("can narrow the search to one project", async () => {
    const { org, owner, project, make, searchUrl } = await setup();
    const other = await createProject(org._id, owner.user._id);
    await make("Navbar in project one");
    await make("Navbar in project two", "", other._id);

    const res = await request(app)
      .get(searchUrl)
      .query({ q: "navbar", projectId: project._id.toString() })
      .set(asUser(owner));

    expect(titles(res)).toEqual(["Navbar in project one"]);
  });

  it("lets guests search", async () => {
    const { org, make, searchUrl } = await setup();
    const guest = await addMember(org._id, "guest", "Guest");
    await make("Fix navbar");

    const res = await request(app).get(searchUrl).query({ q: "navbar" }).set(asUser(guest));

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
  });

  it("rejects missing, too-short and repeated query parameters", async () => {
    const { owner, searchUrl } = await setup();

    const missing = await request(app).get(searchUrl).set(asUser(owner));
    const short = await request(app).get(searchUrl).query({ q: "a" }).set(asUser(owner));
    const repeated = await request(app).get(`${searchUrl}?q=navbar&q=footer`).set(asUser(owner));

    expect(missing.status).toBe(400);
    expect(short.status).toBe(400);
    expect(repeated.status).toBe(400);
  });
});