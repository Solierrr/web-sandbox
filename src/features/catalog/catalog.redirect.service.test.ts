import { afterEach, expect, it, vi } from "vitest";
import { openRenderService } from "./catalog.redirect.service";
import { getSession } from "../access/access.service";
import { notify } from "@solaria.network/web-lib";

vi.mock("@solaria.network/web-lib", () => ({ notify: vi.fn() }));
vi.mock("../access/access.service", () => ({ getSession: vi.fn(), refresh: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("warns once while the service wakes, then opens its Render page", async () => {
  vi.useFakeTimers();
  vi.mocked(getSession).mockReturnValue({ accessToken: "jwt", userId: "id", email: "qa@test", accessTokenExpiresAt: "2099-01-01T00:00:00Z" });
  const tab = { opener: window, closed: false, document: { title: "", body: { textContent: "" } }, location: { replace: vi.fn() } };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  let complete!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { complete = resolve; })));
  const opening = openRenderService("https://api-core-cqfn.onrender.com", "api-core");
  await vi.advanceTimersByTimeAsync(2100);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(tab.document.body.textContent).toContain("acordando");
  complete(new Response('{"awake":false}')); await opening;
  expect(notify).toHaveBeenCalledTimes(1);
  expect(tab.location.replace).toHaveBeenCalledWith("https://api-core-cqfn.onrender.com");
  expect(tab.opener).toBeNull();
});
