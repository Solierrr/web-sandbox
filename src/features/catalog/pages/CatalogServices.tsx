import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GitHubIcon, MenuItem, MenuList, Surface, type ServiceListItem, type ServiceListLink } from "@solaria.network/web-lib";

interface CatalogAction extends ServiceListLink {
  copyText?: string;
  onSelect?: () => void;
}

export interface CatalogRepositoryItem extends Omit<ServiceListItem, "links"> {
  github?: string;
  links: CatalogAction[];
  accesses?: CatalogAccess[];
}

export interface CatalogAccess {
  id: string;
  label: string;
  icon: ReactNode;
  links: CatalogAction[];
  direct?: boolean;
}

const glyphClasses = "inline-flex size-5 shrink-0 items-center justify-center [&_svg]:size-5 [&_svg]:shrink-0";
const triggerClasses = "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-small text-operational-ink hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-operational-ink";

function CatalogLinkMenu({ name, links, access }: { name: string; links: CatalogAction[]; access?: CatalogAccess }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const keyboardOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0 });
  const menuId = `catalog-links-${name}${access ? `-${access.id}` : ""}`;
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const previous = document.activeElement as HTMLElement | null;

    function positionMenu() {
      if (!trigger || !menu) return;
      const bounds = trigger.getBoundingClientRect();
      const margin = 16;
      setPosition({
        position: "fixed",
        left: Math.max(margin, Math.min(bounds.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - margin)),
        top: Math.max(margin, Math.min(bounds.bottom + 8, window.innerHeight - menu.offsetHeight - margin)),
      });
    }

    function dismissOutside(event: PointerEvent) {
      if (!menu?.contains(event.target as Node) && !trigger?.contains(event.target as Node)) close();
    }

    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }

    function moveMenuFocus(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current < 0 ? (step > 0 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
      items[next]?.focus();
    }

    positionMenu();
    if (keyboardOpenRef.current) {
      menu.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    } else {
      menu.focus();
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    menu.addEventListener("keydown", moveMenuFocus);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
      menu.removeEventListener("keydown", moveMenuFocus);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [close, open]);

  if (!links.length) return null;
  const icon = access?.icon ?? links[0].icon;
  const label = access ? `${access.label} de ${name}` : `links de ${name}`;

  if (access?.direct && links.length === 1 && links[0].onSelect) {
    return <button type="button" onClick={links[0].onSelect} aria-label={`Abrir ${label} (nova aba)`} title={label} className={triggerClasses}><span aria-hidden="true" className={glyphClasses}>{icon}</span></button>;
  }

  if (access?.direct && links.length === 1 && links[0].href) {
    return <a href={links[0].href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} title={label} className={triggerClasses}><span aria-hidden="true" className={glyphClasses}>{icon}</span></a>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Abrir ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={links.every((link) => !link.href && !link.copyText) ? `${label}: não configurado` : label}
        disabled={links.every((link) => !link.href && !link.copyText)}
        onClick={(event) => {
          keyboardOpenRef.current = event.detail === 0;
          setOpen((value) => !value);
        }}
        className={`${triggerClasses} disabled:cursor-default disabled:opacity-40`}
      >
        <span aria-hidden="true" className={glyphClasses}>{icon}</span>
      </button>
      {open && createPortal(
        <MenuList ref={menuRef} id={menuId} role="menu" tabIndex={-1} aria-label={`Links de ${name}`} className="z-50 min-w-40 origin-top-right outline-none" style={position}>
          {links.map((link) => (
            <MenuItem
              key={link.label}
              role="menuitem"
              disabled={!link.href && !link.copyText}
              onSelect={() => {
                if (link.copyText) void navigator.clipboard.writeText(link.copyText);
                else if (link.onSelect) link.onSelect();
                else if (link.href) window.open(link.href, "_blank", "noopener,noreferrer");
                close();
              }}
              className="whitespace-nowrap"
            >
              <span aria-hidden="true" className={glyphClasses}>{link.icon}</span>
              {link.label}
            </MenuItem>
          ))}
        </MenuList>,
        document.body,
      )}
    </>
  );
}

export default function CatalogServices({ items }: { items: CatalogRepositoryItem[] }) {
  return (
    <Surface className="w-full">
      <ul className="divide-y divide-operational-border/60">
        {items.map((item) => (
          <li key={item.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
            {item.github ? (
              <a
                href={item.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.name} no GitHub (abre em nova aba)`}
                title={item.description}
                className="group relative inline-flex min-w-0 max-w-full items-center font-medium text-operational-ink focus-visible:outline-2 focus-visible:outline-operational-ink"
              >
                <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
                  <GitHubIcon size={20} />
                </span>
                <span className="min-w-0 break-words transition-transform group-hover:translate-x-6 group-focus-visible:translate-x-6 motion-reduce:transition-none [@media(hover:none)]:translate-x-6">{item.name}</span>
              </a>
            ) : (
              <span className="min-w-0 font-medium text-operational-ink" title={item.description}>{item.name}</span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {item.accesses ? item.accesses.map((access) => <CatalogLinkMenu key={access.id} name={item.name} links={access.links} access={access} />) : <CatalogLinkMenu name={item.name} links={item.links} />}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
