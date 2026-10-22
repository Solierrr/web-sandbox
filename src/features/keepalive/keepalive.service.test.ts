import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDuration, wake } from "./keepalive.service";

afterEach(() => vi.unstubAllGlobals());

describe("keepalive.service", () => {
  it("acorda o serviço com uma requisição simples sem credenciais", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetcher);
    const result = await wake("https://api-core.example.test/");
    expect(result.ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api-core.example.test/");
    expect(init).toMatchObject({ method: "GET", mode: "no-cors", cache: "no-store", credentials: "omit" });
  });

  it("reporta falha quando o serviço não responde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await wake("https://x.example.test/")).ok).toBe(false);
  });

  it("respeita o cancelamento externo", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
      ),
    );
    const pending = wake("https://x.example.test/", controller.signal);
    controller.abort();
    expect((await pending).ok).toBe(false);
  });

  it("formata a duração", () => {
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(12345)).toBe("12.3 s");
  });
});
