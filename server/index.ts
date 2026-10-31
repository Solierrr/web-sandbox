import staticFiles from "@fastify/static";
import { fileURLToPath } from "node:url";
import { createAccessVerifier, readAccessSettings } from "./access/access.auth.js";
import { createApp } from "./app.js";

const access = readAccessSettings();
const app = createApp({ access: access && createAccessVerifier(access) });
if (process.env.NODE_ENV === "production") {
  await app.register(staticFiles, { root: fileURLToPath(new URL("../../dist", import.meta.url)) });
  app.setNotFoundHandler((request, reply) => request.url.startsWith("/api/") ? reply.code(404).send({ message: "Rota não encontrada." }) : reply.sendFile("index.html"));
}
await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT || 5180) });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void app.close(); });
