import { describe, expect, it } from "vitest";
import type { DebugInput, DebugOutcome } from "./debug.service";
import { nodeBlockedReason, replayFor } from "./replay";

const outcome = (debug: Record<string, unknown> | null): DebugOutcome =>
  ({ ok: true, status: 200, elapsed: 1, body: {}, debug: debug ? { nodes: [], ...debug } : null }) as DebugOutcome;

describe("replayFor", () => {
  it("chat: exige o turno devolvido pelo serviço e guarda a persona", () => {
    const input: DebugInput = { kind: "chat", conversationId: "c", message: "oi", persona: "profissional" };
    expect(replayFor(input, outcome({ turn: 3 }))).toEqual({ kind: "chat", turn: 3, persona: "profissional" });
    expect(replayFor(input, outcome({}))).toBeUndefined();
    expect(replayFor(input, outcome({ turn: null }))).toBeUndefined();
  });

  it("certificados: exige o run_id e guarda as URLs", () => {
    const input: DebugInput = { kind: "certificates", nr10Url: "u1", nr35Url: "u2" };
    expect(replayFor(input, outcome({ run_id: "r" }))).toEqual({ kind: "certificates", runId: "r", nr10Url: "u1", nr35Url: "u2" });
    expect(replayFor(input, outcome({}))).toBeUndefined();
  });

  it("CNPJ não precisa de identificador, só do debug", () => {
    const input: DebugInput = { kind: "cnpj", cnpj: "123" };
    expect(replayFor(input, outcome({}))).toEqual({ kind: "cnpj", cnpj: "123" });
    expect(replayFor(input, outcome(null))).toBeUndefined();
  });

  it("imagem: exige o run_id (imagem inválida não tem)", () => {
    const input: DebugInput = { kind: "image", file: new File(["x"], "a.png"), purpose: "product" };
    expect(replayFor(input, outcome({ run_id: "r" }))).toEqual({ kind: "image", runId: "r" });
    expect(replayFor(input, outcome({}))).toBeUndefined();
  });
});

describe("nodeBlockedReason", () => {
  it("só moderation e caption da imagem têm prompt", () => {
    const replay = { kind: "image", runId: "r" } as const;
    expect(nodeBlockedReason(replay, "moderation")).toBeUndefined();
    expect(nodeBlockedReason(replay, "caption")).toBeUndefined();
    expect(nodeBlockedReason(replay, "policy")).toMatch(/não chama um modelo/);
    expect(nodeBlockedReason({ kind: "chat", turn: 0 }, "policy")).toBeUndefined();
    expect(nodeBlockedReason(undefined, "policy")).toBeUndefined();
  });
});
