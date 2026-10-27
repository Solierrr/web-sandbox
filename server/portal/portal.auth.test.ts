// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyQaToken } from "./portal.auth.js";

describe("QA JWT verification", () => {
  let keys: Awaited<ReturnType<typeof generateKeyPair>>;
  let resolver: ReturnType<typeof createLocalJWKSet>;
  beforeAll(async () => {
    keys = await generateKeyPair("RS256");
    resolver = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: "qa" }] });
  });
  const token = (type = "access", issuer = process.env.JWT_ISSUER || "solaria-auth", expiry = "5m") => new SignJWT({ token_type: type }).setProtectedHeader({ alg: "RS256", kid: "qa" }).setIssuer(issuer).setSubject("qa-user").setIssuedAt().setExpirationTime(expiry).sign(keys.privateKey);
  it("accepts a signed access token without roles", async () => { await expect(verifyQaToken(await token(), resolver)).resolves.toBeUndefined(); });
  it("rejects expired tokens", async () => { await expect(verifyQaToken(await token("access", undefined, "-1s"), resolver)).rejects.toThrow(); });
  it("rejects another issuer", async () => { await expect(verifyQaToken(await token("access", "other"), resolver)).rejects.toThrow(); });
  it("rejects refresh tokens", async () => { await expect(verifyQaToken(await token("refresh"), resolver)).rejects.toThrow(); });
  it("rejects unsigned mocks", async () => { await expect(verifyQaToken("mock-access-token", resolver)).rejects.toThrow(); });
  it("rejects signatures from a different key", async () => {
    const other = await generateKeyPair("RS256");
    const forged = await new SignJWT({ token_type: "access" }).setProtectedHeader({ alg: "RS256", kid: "qa" }).setIssuer("solaria-auth").setSubject("user").setIssuedAt().setExpirationTime("5m").sign(other.privateKey);
    await expect(verifyQaToken(forged, resolver)).rejects.toThrow();
  });
});
