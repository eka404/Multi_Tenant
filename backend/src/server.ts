import "dotenv/config";
import http from "http";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./socket.js";
import { app } from "./app.js";

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDB().then(() =>
  httpServer.listen(env.port, () => console.log(`Server running on ${env.port}`))
);