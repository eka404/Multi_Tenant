import http from "http";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { initSocket } from "../src/socket.js";
import type { Server } from "socket.io";

const TEST_URI = process.env.TEST_MONGO_URI ?? "mongodb://127.0.0.1:27017/issue-tracker-test";
let io: Server;

beforeAll(async () => {
  io = initSocket(http.createServer(app));

  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  if (!mongoose.connection.name.endsWith("test")) {
    throw new Error(
      `Refusing to run tests against "${mongoose.connection.name}": the database name must end in "test"`
    );
  }
  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.init()));
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB test database is not connected");
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  if (io) await new Promise<void>((resolve) => io.close(() => resolve()));
  await mongoose.disconnect();
});
