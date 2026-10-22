import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { getEmbeddingProvider } from "../lib/embeddings.js";
import { backfillEmbeddings, flushEmbeddings, pendingEmbeddings } from "../lib/embeddingQueue.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!getEmbeddingProvider()) {
    console.error("VOYAGE_API_KEY is not set, so there is nothing to embed with");
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(env.mongoUri);
  console.log(`Queued ${await backfillEmbeddings()} tickets`);

  while (pendingEmbeddings() > 0) {
    await flushEmbeddings();
    if (pendingEmbeddings() > 0) await sleep(5000);
  }
  console.log("Done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());