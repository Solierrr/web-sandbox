import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { getSession, restoreSession } from "./features/access/access.service";
import type { ReactNode } from "react";

vi.mock("./features/access/access.service", () => ({ getSession: vi.fn(), subscribe: () => () => undefined, logout: vi.fn(), restoreSession: vi.fn() }));
vi.mock("./features/access/pages/LoginPage", () => ({ default: () => <p>Entrar na conta</p> }));
vi.mock("./features/catalog/pages/CatalogPage", () => ({ default: () => <p>Catálogo autenticado</p> }));
vi.mock("@solaria.network/web-lib", () => ({
  Loading: () => <p>Restaurando…</p>, Toast: () => null, notify: vi.fn(),
  SaaSLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  WhiteButton: ({ content, onClick }: { content: string; onClick: () => void }) => <button onClick={onClick}>{content}</button>,
}));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSession).mockReturnValue(null); });
afterEach(cleanup);
it("offers restoration retry instead of a false logout on network failure", async () => {
  vi.mocked(restoreSession).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  render(<App />); expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Entrar na conta")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Entrar na conta")).toBeTruthy();
});
