import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const credentials = { name: "Ada Lovelace", email: "ada@example.com", password: "password123" };
const register = () => request(app).post("/api/auth/register").send(credentials);

describe("register", () => {
  it("creates a user, returns an access token and sets the refresh cookie", async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(String(res.headers["set-cookie"])).toContain("refreshToken=");
  });

  it("rejects a duplicate email", async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, password: "short" });
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  it("accepts the right password", async () => {
    await register();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await register();
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe("/me", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const reg = await register();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
  });
});

describe("refresh and logout", () => {
  it("issues a new access token from the refresh cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects refresh when there is no cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("stops refresh from working after logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    await agent.post("/api/auth/logout");
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});
