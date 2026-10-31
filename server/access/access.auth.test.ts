// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createAccessVerifier, readAccessSettings } from "./access.auth.js";

const settings = { teamDomain: "team.cloudflareaccess.com", audience: "aud-123" };

describe("Cloudflare Access settings", () => {
  it("stays off when nothing is configured", () => { expect(readAccessSettings({})).toBeUndefined(); });
  it("requires the team domain and the audience together", () => {
    expect(() => readAccessSettings({ ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" })).toThrow();
    expect(() => readAccessSettings({ ACCESS_AUD: "aud" })).toThrow();
  });
  it("normalizes the team domain", () => {
    expect(readAccessSettings({ ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com/", ACCESS_AUD: "aud" })).toEqual({ teamDomain: "team.cloudflareaccess.com", audience: "aud" });
  });
});

describe("Cloudflare Access JWT", () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let verify: (token: string) => Promise<void>;
  beforeAll(async () => {
    keys = await generateKeyPair("RS256");
    verify = createAccessVerifier(settings, createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "cf" }] }));
  });
  const token = (claims: Record<string, unknown> = { email: "dev@example.com" }, audience = settings.audience, issuer = `https://${settings.teamDomain}`, expiry = "5m") =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "cf" }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(keys.privateKey);
  it("accepts a token for this app", async () => { await expect(verify(await token())).resolves.toBeUndefined(); });
  it("rejects another application's audience", async () => { await expect(verify(await token(undefined, "other"))).rejects.toThrow(); });
  it("rejects another issuer", async () => { await expect(verify(await token(undefined, settings.audience, "https://evil.example.com"))).rejects.toThrow(); });
  it("rejects expired tokens and tokens without an e-mail", async () => {
    await expect(verify(await token(undefined, settings.audience, undefined, "-1s"))).rejects.toThrow();
    await expect(verify(await token({}))).rejects.toThrow();
  });
  it("rejects a signature from another key", async () => {
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({ email: "dev@example.com" }).setProtectedHeader({ alg: "RS256", kid: "cf" }).setIssuer(`https://${settings.teamDomain}`).setAudience(settings.audience).setIssuedAt().setExpirationTime("5m").sign(other.privateKey);
    await expect(verify(forged)).rejects.toThrow();
  });
});
