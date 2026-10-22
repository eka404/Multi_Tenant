import "dotenv/config";
import http from "http";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./socket.js";
import { app } from "./app.js";
import { backfillEmbeddings } from "./lib/embeddingQueue.js";

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDB().then(() => {
  httpServer.listen(env.port, () => console.log(`Server running on ${env.port}`));
  backfillEmbeddings().catch((err) => console.warn("embedding backfill failed:", (err as Error).message));
});