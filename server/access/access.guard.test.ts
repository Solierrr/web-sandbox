// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";

describe("Cloudflare Access guard", () => {
  const access = vi.fn(async (token: string) => { if (token !== "good") throw new Error("invalid"); });
  const app = createApp({ access });
  it("keeps the health probe open", async () => { expect((await app.inject({ url: "/health" })).statusCode).toBe(200); });
  it("refuses requests without the Access token, including the API", async () => {
    expect((await app.inject({ url: "/" })).statusCode).toBe(403);
    expect((await app.inject({ url: "/api/qa/services" })).statusCode).toBe(403);
  });
  it("refuses an invalid token", async () => {
    expect((await app.inject({ url: "/api/qa/services", headers: { "cf-access-jwt-assertion": "bad" } })).statusCode).toBe(403);
  });
  it("lets a valid token through to the normal login check", async () => {
    const response = await app.inject({ url: "/api/qa/services", headers: { "cf-access-jwt-assertion": "good" } });
    expect(response.statusCode).toBe(401);
  });
});
