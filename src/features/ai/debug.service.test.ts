import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { accessToken: string; mock?: true },
  refresh: vi.fn(),
}));
vi.mock("../access/access.service", () => ({
  getSession: () => state.session,
  refresh: state.refresh,
}));

import { localBase, runDebug } from "./debug.service";
import { aiTargets, targetById } from "./targets";

const assistant = targetById("assistant")!;
const debug = { nodes: [{ order: 1, node: "router", status: "ok", duration_ms: 12, input: {}, output: {}, llm_calls: [], error: null }] };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const chat = { kind: "chat", conversationId: "c1", message: "oi", persona: "demandante" } as const;

beforeEach(() => {
  state.session = { accessToken: "jwt-1" };
  state.refresh.mockReset();
});

describe("runDebug", () => {
  it("envia o JWT do admin e separa a resposta do debug", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { response: "olá", debug }));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await runDebug(assistant, "QA", chat);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai-assistant-5ljd.onrender.com/debug/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-1");
    expect(JSON.parse(init.body as string)).toEqual({ conversation_id: "c1", message: "oi", persona: "demandante" });
    expect(init.credentials).toBe("omit");
    expect(outcome).toMatchObject({ ok: true, body: { response: "olá" } });
    expect(outcome.debug?.nodes).toHaveLength(1);
    expect(outcome.ok && "debug" in outcome.body).toBe(false);
  });

  it("usa o host de PROD quando pedido", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { response: "ok", debug }));
    vi.stubGlobal("fetch", fetchMock);
    await runDebug(assistant, "PROD", chat);
    expect(fetchMock.mock.calls[0][0]).toBe("https://assistant.solarianetwork.site/debug/chat");
  });

  it("monta o multipart da análise de imagem sem fixar o Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { alt_text: "x", debug: { nodes: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const image = targetById("image")!;
    const file = new File(["abc"], "foto.png", { type: "image/png" });
    await runDebug(image, "QA", { kind: "image", file, purpose: "product" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get("purpose")).toBe("product");
    expect((form.get("image") as File).name).toBe("foto.png");
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("renova a sessão uma vez em 401 e repete", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(401, { detail: "Token inválido" }))
      .mockResolvedValueOnce(reply(200, { response: "ok", debug }));
    vi.stubGlobal("fetch", fetchMock);
    state.refresh.mockImplementation(async () => {
      state.session = { accessToken: "jwt-2" };
    });
    const outcome = await runDebug(assistant, "QA", chat);
    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retry.headers as Record<string, string>).Authorization).toBe("Bearer jwt-2");
  });

  it.each([
    [404, "disabled"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [422, "invalid"],
    [500, "server"],
  ] as const)("HTTP %i vira %s", async (status, reason) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(status, { detail: "x" })));
    state.refresh.mockResolvedValue(undefined);
    const outcome = await runDebug(assistant, "QA", chat);
    expect(outcome).toMatchObject({ ok: false, reason, status });
  });

  it("mantém o debug parcial de uma falha 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, { detail: "ValueError: falhou", debug })));
    const outcome = await runDebug(assistant, "QA", chat);
    expect(outcome).toMatchObject({ ok: false, reason: "server", message: "ValueError: falhou" });
    expect(outcome.debug?.nodes[0].node).toBe("router");
  });

  it("lê a mensagem de erro de validação (422 com lista)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(422, { detail: [{ msg: "campo obrigatório" }] })));
    const outcome = await runDebug(assistant, "QA", chat);
    expect(outcome).toMatchObject({ ok: false, reason: "invalid", message: "campo obrigatório" });
  });

  it("não chama a rede com sessão de mock ou sem sessão", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    state.session = { accessToken: "mock-access-1", mock: true };
    expect(await runDebug(assistant, "QA", chat)).toMatchObject({ ok: false, reason: "mock-session" });
    state.session = null;
    expect(await runDebug(assistant, "QA", chat)).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede vira network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await runDebug(assistant, "QA", chat)).toMatchObject({ ok: false, reason: "network" });
  });

  it("cancelamento vira aborted", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }),
    );
    expect(await runDebug(assistant, "QA", chat, controller.signal)).toMatchObject({ ok: false, reason: "aborted" });
  });
});

describe("execução personalizada por serviço", () => {
  const prompts = [{ call: 0, prompt: [{ type: "system", content: "novo", editable: true }, { type: "human", content: "[imagem omitida]", editable: false }] }];
  const sent = async (target: string, input: Parameters<typeof runDebug>[2]) => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { debug }));
    vi.stubGlobal("fetch", fetchMock);
    await runDebug(targetById(target)!, "QA", input);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, body: JSON.parse(init.body as string), init };
  };

  it("chat: turno, nó e ocorrência dentro de custom, sem a marca editable", async () => {
    const { body } = await sent("assistant", { ...chat, custom: { turn: 2, node: "router", occurrence: 1, prompts } });
    expect(body.custom).toEqual({
      turn: 2,
      node: "router",
      occurrence: 1,
      stop_after_node: true,
      prompts: [{ call: 0, prompt: [{ type: "system", content: "novo" }, { type: "human", content: "[imagem omitida]" }] }],
    });
  });

  it("certificados: reenvia as URLs com o run_id", async () => {
    const { url, body } = await sent("certificates", {
      kind: "certificates",
      nr10Url: "https://a/nr10",
      nr35Url: "https://a/nr35",
      custom: { runId: "run-1", node: "nr10_agent", occurrence: 0, prompts },
    });
    expect(url).toContain("/debug/certificates/validate");
    expect(body).toMatchObject({
      cert_nr10_url: "https://a/nr10",
      cert_nr35_url: "https://a/nr35",
      custom: { run_id: "run-1", node: "nr10_agent", occurrence: 0, stop_after_node: true },
    });
  });

  it("CNPJ: reenvia o CNPJ com o nó cnpj_validation", async () => {
    const { body } = await sent("cnpj", { kind: "cnpj", cnpj: "12.345.678/0001-90", custom: { node: "cnpj_validation", occurrence: 0, prompts } });
    expect(body).toMatchObject({ cnpj: "12.345.678/0001-90", custom: { node: "cnpj_validation", stop_after_node: true } });
    expect(body.custom).not.toHaveProperty("run_id");
  });

  it("imagem: vai para a rota de etapa em JSON, com o run_id no topo", async () => {
    const { url, body, init } = await sent("image", { kind: "image-stage", custom: { runId: "run-img", node: "caption", occurrence: 0, prompts } });
    expect(url).toContain("/debug/images/stage");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(body).toMatchObject({ run_id: "run-img", node: "caption", occurrence: 0, stop_after_node: true });
    expect(body).not.toHaveProperty("custom");
  });

  it("serviço sem rota de etapa recusa antes de chamar a rede", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await runDebug(assistant, "QA", { kind: "image-stage", custom: { runId: "r", node: "caption", occurrence: 0, prompts } });
    expect(outcome).toMatchObject({ ok: false, reason: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("servidor local", () => {
  it("só aceita localhost e nunca manda o token para outro host", async () => {
    expect(localBase("http://localhost:8000/")).toBe("http://localhost:8000");
    expect(localBase("http://127.0.0.1:8001")).toBe("http://127.0.0.1:8001");
    expect(localBase("https://evil.example.com")).toBeUndefined();
    expect(localBase("http://localhost.evil.com")).toBeUndefined();
    expect(localBase("http://user:pass@localhost:8000")).toBeUndefined();
    expect(localBase("não é url")).toBeUndefined();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await runDebug(assistant, "QA", chat, undefined, "https://evil.example.com")).toMatchObject({ ok: false, reason: "no-url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("chama a rota de debug no servidor local", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { response: "ok", debug }));
    vi.stubGlobal("fetch", fetchMock);
    await runDebug(assistant, "QA", chat, undefined, "http://localhost:8000");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/debug/chat");
  });
});

describe("aiTargets", () => {
  it("todas as rotas são de debug e os ids são únicos", () => {
    expect(new Set(aiTargets.map((item) => item.id)).size).toBe(aiTargets.length);
    for (const item of aiTargets) {
      expect(item.path.startsWith("/debug/")).toBe(true);
      if (item.stagePath) expect(item.stagePath.startsWith("/debug/")).toBe(true);
    }
  });
});
