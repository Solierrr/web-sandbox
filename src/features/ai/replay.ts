import type { DebugInput, DebugOutcome } from "./debug.service";

export type Replay =
  | { kind: "chat"; turn: number; persona?: string }
  | { kind: "certificates"; runId: string; nr10Url: string; nr35Url: string }
  | { kind: "cnpj"; cnpj: string }
  | { kind: "image"; runId: string };

export function replayFor(input: DebugInput, outcome: DebugOutcome): Replay | undefined {
  const debug = outcome.debug;
  if (!debug) return undefined;
  switch (input.kind) {
    case "chat":
      return typeof debug.turn === "number" ? { kind: "chat", turn: debug.turn, persona: input.persona } : undefined;
    case "certificates":
      return typeof debug.run_id === "string"
        ? { kind: "certificates", runId: debug.run_id, nr10Url: input.nr10Url, nr35Url: input.nr35Url }
        : undefined;
    case "cnpj":
      return { kind: "cnpj", cnpj: input.cnpj };
    case "image":
      return typeof debug.run_id === "string" ? { kind: "image", runId: debug.run_id } : undefined;
    default:
      return undefined;
  }
}

const IMAGE_REPLAYABLE = new Set(["moderation", "caption"]);

export function nodeBlockedReason(replay: Replay | undefined, node: string): string | undefined {
  if (replay?.kind === "image" && !IMAGE_REPLAYABLE.has(node))
    return "Esta etapa não chama um modelo: só moderation e caption têm prompt para editar.";
  return undefined;
}

export const NO_REPLAY_REASONS = {
  history:
    "Esta conversa veio do histórico, não do Simulador. A execução personalizada só funciona em respostas geradas pelo Simulador, que ainda estão nos serviços.",
  oldService:
    "O serviço não devolveu o identificador desta execução (debug.turn ou debug.run_id). Ele ainda está numa versão sem execução personalizada.",
} as const;
