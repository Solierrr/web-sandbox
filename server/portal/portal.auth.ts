import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const jwks = createRemoteJWKSet(new URL("https://api-auth-xw6o.onrender.com/.well-known/jwks.json"));

// Todos os usuários autenticados de QA têm acesso; não há papel de administrador.
export async function verifyQaToken(token: string, key: JWTVerifyGetKey = jwks) {
  const { payload } = await jwtVerify(token, key, {
    issuer: process.env.JWT_ISSUER || "solaria-auth",
    algorithms: ["RS256"],
    requiredClaims: ["exp", "sub", "iat"],
  });
  if (payload.token_type !== "access" || !payload.sub) throw new Error("Invalid access token");
}
