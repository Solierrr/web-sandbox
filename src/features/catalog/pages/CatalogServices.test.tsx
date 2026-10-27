import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CatalogServices from "./CatalogServices";

afterEach(cleanup);

describe("CatalogServices", () => {
  it("opens the native Swagger directly instead of an environment menu", () => {
    const open = vi.fn();
    render(<CatalogServices items={[{ name: "api-email", links: [], accesses: [{ id: "swagger-qa", label: "Swagger QA", icon: null, direct: true, links: [{ label: "Swagger QA", icon: null, href: "/swagger.html?service=api-email", onSelect: open }] }] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Swagger QA de api-email (nova aba)" }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("mantém interfaces separadas e permite acesso direto ao provedor", () => {
    render(<CatalogServices items={[{
      name: "api-email",
      github: "https://github.com/Solierrr/api-email",
      links: [],
      accesses: [
        { id: "swagger", label: "Swagger", icon: null, links: [
          { label: "GCP", icon: null, href: "https://example.com/docs" },
          { label: "Render", icon: null, href: "https://example.onrender.com/docs" },
        ] },
        { id: "mailpit", label: "Mailpit", icon: null, direct: true, links: [{ label: "Render", icon: null, href: "https://mail.example.com" }] },
      ],
    }]} />);
    expect(screen.getByRole("link", { name: "Mailpit de api-email (abre em nova aba)" }).getAttribute("href")).toBe("https://mail.example.com");
    fireEvent.click(screen.getByRole("button", { name: "Abrir Swagger de api-email" }), { detail: 1 });
    expect(screen.getByRole("menuitem", { name: "GCP" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Render" })).toBeDefined();
  });

  it("usa o nome como link seguro do GitHub e mantém os links de ambiente", () => {
    render(
      <MemoryRouter>
        <CatalogServices items={[{
          name: "web-app",
          github: "https://github.com/Solierrr/web-app",
          links: [{ label: "Aplicação QA", tag: "QA", icon: null, href: "https://web-app-ldi0.onrender.com/" }],
        }]} />
      </MemoryRouter>,
    );
    const github = screen.getByRole("link", { name: "web-app no GitHub (abre em nova aba)" });
    expect(github.getAttribute("href")).toBe("https://github.com/Solierrr/web-app");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.getAttribute("rel")).toContain("noopener");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    const trigger = screen.getByRole("button", { name: "Abrir links de web-app" });
    fireEvent.click(trigger, { detail: 1 });
    const menu = screen.getByRole("menu", { name: "Links de web-app" });
    const option = screen.getByRole("menuitem", { name: "Aplicação QA" });
    expect(document.activeElement).toBe(menu);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(option);
    fireEvent.keyDown(menu, { key: "Escape" });
    fireEvent.click(trigger, { detail: 0 });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Aplicação QA" }));
  });
});
