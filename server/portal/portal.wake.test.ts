// @vitest-environment node
import { expect, it, vi } from "vitest";
import { probeService } from "./portal.wake.js";

it("checks only registered services without following redirects", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  expect(await probeService("api-auth", fetcher)).toEqual({ awake: true, httpStatus: 200 });
  expect(String(fetcher.mock.calls[0][0])).toBe("https://api-auth-xw6o.onrender.com/.well-known/jwks.json");
  expect(fetcher.mock.calls[0][1]?.redirect).toBe("manual");
  expect(await probeService("https://evil.test", fetcher)).toBeNull();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("reports an unanswered or unavailable service without claiming it is healthy", async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  expect(await probeService("api-core", fetcher)).toEqual({ awake: false });
  expect(await probeService("api-core", fetcher)).toEqual({ awake: false, httpStatus: 503 });
});
