import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimiters.js";
import authRoutes from "./routes/authRoute.js";
import orgRoutes from "./routes/orgRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const app = express();
if (env.trustProxy) app.set("trust proxy", 1);

const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
if (!env.isProd) delete csp["upgrade-insecure-requests"];
app.use(helmet({ contentSecurityPolicy: { directives: csp } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRoutes);
app.use("/api/orgs", orgRoutes);
app.use("/api/orgs", projectRoutes);
app.use("/api/orgs", ticketRoutes);
app.use("/api/orgs", commentRoutes);
app.use("/api/notifications", notificationRoutes);
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});
