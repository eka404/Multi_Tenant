import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { Ticket } from "../src/models/Ticket.js";
import { TicketEmbedding } from "../src/models/TicketEmbedding.js";
import { setEmbeddingProvider } from "../src/lib/embeddings.js";
import { flushEmbeddings, queueEmbedding } from "../src/lib/embeddingQueue.js";
import { asUser, createOrg, createProject } from "./factories.js";
import { FakeEmbeddings } from "./fakeEmbeddings.js";

let fake: FakeEmbeddings;

beforeEach(() => {
  fake = new FakeEmbeddings();
  setEmbeddingProvider(fake);
});

afterAll(() => setEmbeddingProvider(undefined));

async function setup() {
  const { org, owner } = await createOrg("Owner");
  const project = await createProject(org._id, owner.user._id);
  const make = async (title: string) => {
    const ticket = await Ticket.create({
      orgId: org._id,
      projectId: project._id,
      title,
      createdBy: owner.user._id,
    });
    queueEmbedding(ticket._id.toString());
    return ticket;
  };
  const search = (q: string, mode = "semantic") =>
    request(app)
      .get(`/api/orgs/${org._id}/search/tickets`)
      .query({ q, mode })
      .set(asUser(owner));
  return { org, owner, project, make, search };
}

const titles = (res: { body: { tickets: { title: string }[] } }) => res.body.tickets.map((t) => t.title);

describe("semantic search", () => {
  it("finds tickets by meaning, not by shared words", async () => {
    const { make, search } = await setup();
    await make("Token refresh fails after logout");
    await make("Update navbar layout on mobile");
    await make("Write pricing copy");
    await flushEmbeddings();

    const res = await search("users can't sign in");

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("semantic");
    expect(titles(res)).toEqual(["Token refresh fails after logout"]);
  });

  it("only searches the caller's own organization", async () => {
    const a = await setup();
    const b = await setup();
    await a.make("Fix login bug");
    await b.make("Fix login bug");
    await flushEmbeddings();

    const res = await a.search("sign in");

    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].orgId).toBe(a.org._id.toString());
  });

  it("falls back to keyword search when no provider is available", async () => {
    setEmbeddingProvider(null);
    const { make, search } = await setup();
    await make("Fix navbar");

    const res = await search("navbar");

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("keyword");
    expect(titles(res)).toEqual(["Fix navbar"]);
  });

  it("falls back to keyword search when semantic query embedding fails", async () => {
    const { make, search } = await setup();
    await make("Fix navbar");
    await flushEmbeddings();
    fake.failNext = true;

    const res = await search("navbar");

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("keyword");
    expect(titles(res)).toEqual(["Fix navbar"]);
  });

  it("embeds again only when the text changes", async () => {
    const { org, owner, make } = await setup();
    const ticket = await make("Fix login bug");
    await flushEmbeddings();
    expect(fake.calls).toHaveLength(1);

    queueEmbedding(ticket._id.toString());
    await flushEmbeddings();
    expect(fake.calls).toHaveLength(1);

    await request(app)
      .patch(`/api/orgs/${org._id}/tickets/${ticket._id}`)
      .set(asUser(owner))
      .send({ title: "Fix session bug" });
    await flushEmbeddings();
    expect(fake.calls).toHaveLength(2);
  });

  it("recovers after a temporary provider failure", async () => {
    const { make } = await setup();
    const ticket = await make("Fix login bug");

    fake.failNext = true;
    await flushEmbeddings();
    expect(await TicketEmbedding.countDocuments({ ticketId: ticket._id })).toBe(0);

    await flushEmbeddings();
    expect(await TicketEmbedding.countDocuments({ ticketId: ticket._id })).toBe(1);
  });
});