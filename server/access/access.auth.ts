import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessSettings { teamDomain: string; audience: string }

// O Cloudflare Access assina um JWT em cada requisição que passa por ele; o servidor confere a assinatura,
// o emissor e o AUD do app. Sem isso, quem chamasse o endereço direto do Render ignoraria o Access.
export function readAccessSettings(env: NodeJS.ProcessEnv = process.env): AccessSettings | undefined {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  if (!teamDomain && !audience) return undefined;
  if (!teamDomain || !audience) throw new Error("ACCESS_TEAM_DOMAIN e ACCESS_AUD precisam ser definidos juntos.");
  return { teamDomain: teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, ""), audience };
}

export function createAccessVerifier(settings: AccessSettings, key?: JWTVerifyGetKey) {
  const keys = key ?? createRemoteJWKSet(new URL(`https://${settings.teamDomain}/cdn-cgi/access/certs`));
  return async (token: string) => {
    await jwtVerify(token, keys, {
      issuer: `https://${settings.teamDomain}`,
      audience: settings.audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "email"],
    });
  };
}
