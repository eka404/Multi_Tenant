import { createHash } from "crypto";
import { Ticket } from "../models/Ticket.js";
import { TicketEmbedding } from "../models/TicketEmbedding.js";
import { getEmbeddingProvider, type EmbeddingProvider } from "./embeddings.js";

const BATCH_SIZE = 64;
const MAX_ATTEMPTS = 5;

const dirty = new Set<string>();
const attempts = new Map<string, number>();
let timer: NodeJS.Timeout | null = null;
let draining = false;

export function ticketText(t: { title: string; description?: string | null; labels?: string[] }) {
  return [t.title, (t.labels ?? []).join(" "), t.description ?? ""].join("\n").trim().slice(0, 2000);
}

function hashOf(text: string, model: string) {
  return createHash("sha1").update(`${model}\n${text}`).digest("hex");
}

function schedule(ms: number) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void drain();
  }, ms);
  timer.unref();
}

export function queueEmbedding(ticketId: string) {
  if (!getEmbeddingProvider()) return;
  dirty.add(ticketId);
  schedule(2000);
}

export function pendingEmbeddings() {
  return dirty.size;
}

async function embedBatch(ids: string[], provider: EmbeddingProvider) {
  const tickets = await Ticket.find({ _id: { $in: ids } });
  const existing = await TicketEmbedding.find({ ticketId: { $in: ids } })
    .select("ticketId textHash")
    .lean();
  const known = new Map(existing.map((e) => [e.ticketId.toString(), e.textHash] as const));

  const todo = tickets
    .map((ticket) => {
      const text = ticketText(ticket);
      return { ticket, text, textHash: hashOf(text, provider.model) };
    })
    .filter((x) => known.get(x.ticket._id.toString()) !== x.textHash);
  if (todo.length === 0) return;

  const vectors = await provider.embed(todo.map((x) => x.text), "document");

  await TicketEmbedding.bulkWrite(
    todo.map((x, i) => ({
      updateOne: {
        filter: { ticketId: x.ticket._id },
        update: {
          $set: {
            orgId: x.ticket.orgId,
            projectId: x.ticket.projectId,
            embeddingModel: provider.model,
            textHash: x.textHash,
            vector: vectors[i],
          },
        },
        upsert: true,
      },
    }))
  );
}

async function drain() {
  const provider = getEmbeddingProvider();
  if (!provider || draining) return;
  draining = true;
  try {
    while (dirty.size > 0) {
      const ids = [...dirty].slice(0, BATCH_SIZE);
      ids.forEach((id) => dirty.delete(id));
      try {
        await embedBatch(ids, provider);
        ids.forEach((id) => attempts.delete(id));
      } catch (err) {
        console.warn("embedding batch failed, will retry:", (err as Error).message);
        let worst = 1;
        for (const id of ids) {
          const n = (attempts.get(id) ?? 0) + 1;
          if (n >= MAX_ATTEMPTS) {
            attempts.delete(id);
            console.warn(`giving up on embedding ticket ${id}`);
            continue;
          }
          attempts.set(id, n);
          dirty.add(id);
          worst = Math.max(worst, n);
        }
        schedule(Math.min(60_000, 4_000 * 2 ** worst));
        return;
      }
    }
  } finally {
    draining = false;
  }
}

export async function flushEmbeddings() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await drain();
}

export async function backfillEmbeddings() {
  const provider = getEmbeddingProvider();
  if (!provider) return 0;

  const done = await TicketEmbedding.find({ embeddingModel: provider.model }).select("ticketId").lean();
  const have = new Set(done.map((e) => e.ticketId.toString()));
  const all = await Ticket.find().select("_id").lean();
  const missing = all.map((t) => t._id.toString()).filter((id) => !have.has(id)).slice(0, 5000);

  missing.forEach((id) => dirty.add(id));
  if (missing.length > 0) {
    console.log(`Embedding ${missing.length} tickets in the background`);
    schedule(1000);
  }
  return missing.length;
}