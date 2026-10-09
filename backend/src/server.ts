import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoute.js";
import cookieParser from "cookie-parser";
import orgRoutes from "./routes/orgRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import http from "http";
import { initSocket } from "./socket.js";
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/orgs", projectRoutes);
app.use("/api/orgs", ticketRoutes);
app.use("/api/orgs", commentRoutes);
app.use("/api/notifications", notificationRoutes);

const httpServer = http.createServer(app);
initSocket(httpServer);

connectDB().then(() =>
  httpServer.listen(env.port, () => console.log(`Server running on ${env.port}`))
);