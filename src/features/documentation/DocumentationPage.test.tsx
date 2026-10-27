import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DocumentationPage from "./DocumentationPage";
import { loadSpec } from "./documentation.service";
import "../../config/i18n/internationalization";

vi.mock("./documentation.service", () => ({ loadSpec: vi.fn(), authorizeRequest: vi.fn() }));
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("mounts the real Swagger UI inside the kit surface", async () => {
  vi.mocked(loadSpec).mockResolvedValue({ openapi: "3.0.3", info: { title: "Email QA contract", version: "1.0" }, paths: {} });
  const { container } = render(<MemoryRouter initialEntries={["/docs/api-email"]}><Routes><Route path="/docs/:id" element={<DocumentationPage />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(container.querySelector(".swagger-scroll .swagger-ui")).not.toBeNull());
  expect(await screen.findByText("Email QA contract")).toBeTruthy();
});
