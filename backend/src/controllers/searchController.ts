import type { Response } from "express";
import { Ticket } from "../models/Ticket.js";
import { TicketEmbedding } from "../models/TicketEmbedding.js";
import { getEmbeddingProvider, type EmbeddingProvider } from "../lib/embeddings.js";
import { isObjectId } from "../middlewares/validateId.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";

const MIN_SCORE = 0.3;
const MAX_RESULTS = 20;
const MAX_CANDIDATES = 2000;

const queryVectors = new Map<string, number[]>();

async function embedQuery(provider: EmbeddingProvider, q: string) {
  const key = `${provider.model}:${q.toLowerCase()}`;
  const hit = queryVectors.get(key);
  if (hit) return hit;
  const [vector] = await provider.embed([q], "query");
  queryVectors.set(key, vector);
  if (queryVectors.size > 200) queryVectors.delete(queryVectors.keys().next().value!);
  return vector;
}

function cosine(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

async function keywordSearch(orgId: string, projectId: string | undefined, q: string) {
  return Ticket.find(
    { orgId, ...(projectId ? { projectId } : {}), $text: { $search: q } },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(50);
}

async function semanticSearch(orgId: string, projectId: string | undefined, q: string) {
  const provider = getEmbeddingProvider();
  if (!provider) return null;

  const queryVector = await embedQuery(provider, q);
  const candidates = await TicketEmbedding.find({
    orgId,
    ...(projectId ? { projectId } : {}),
    embeddingModel: provider.model,
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  const ranked = candidates
    .map((c) => ({ ticketId: c.ticketId, score: cosine(queryVector, c.vector) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const tickets = await Ticket.find({
    _id: { $in: ranked.map((r) => r.ticketId) },
    orgId,
    ...(projectId ? { projectId } : {}),
  });
  const byId = new Map(tickets.map((t) => [t._id.toString(), t] as const));
  return ranked.flatMap((r) => {
    const ticket = byId.get(r.ticketId.toString());
    return ticket ? [{ ...ticket.toObject(), score: r.score }] : [];
  });
}

export async function searchTickets(req: OrgScopedRequest, res: Response) {
  const { q, projectId } = req.query;

  if (typeof q !== "string" || q.trim().length < 2 || q.length > 100) {
    return res.status(400).json({ message: "q must be 2 to 100 characters" });
  }
  if (projectId !== undefined && !isObjectId(projectId)) return res.status(400).json({ message: "Invalid projectId" });

  const orgId = req.membership!.orgId;
  const pid = typeof projectId === "string" ? projectId : undefined;
  const text = q.trim();

  if (req.query.mode === "semantic") {
    try {
      const results = await semanticSearch(orgId, pid, text);
      if (results) return res.json({ tickets: results, mode: "semantic" });
    } catch (err) {
      console.warn("semantic search failed, falling back to keyword search:", (err as Error).message);
    }
  }

  res.json({ tickets: await keywordSearch(orgId, pid, text), mode: "keyword" });
}