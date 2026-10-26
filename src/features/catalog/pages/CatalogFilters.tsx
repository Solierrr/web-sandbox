import { useEffect, useRef, useState, type ReactNode } from "react";
import { GroupAction, SurfaceGroup } from "@solaria.network/web-lib";
import { filterGroups, type CatalogFilters as Filters, type FilterGroupId } from "../../../config/catalog";

interface CatalogFiltersProps {
  filters: Filters;
  icons: Record<FilterGroupId, Record<string, ReactNode>>;
  onToggle: (group: FilterGroupId, id: string) => void;
}

export default function CatalogFilters({ filters, icons, onToggle }: CatalogFiltersProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setEdges({
      left: element.scrollLeft > 1,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <div
        ref={viewport}
        role="region"
        aria-label="Filtros de stacks"
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain py-2 focus-visible:outline-2 focus-visible:outline-operational-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 240 : -240, behavior: "smooth" });
        }}
      >
        <div className="flex w-max min-w-full items-center justify-center gap-4 px-1">
          {filterGroups.map((group) => (
            <SurfaceGroup key={group.id} className="shrink-0" direction="horizontal" divided={false} role="group" aria-label={group.label}>
              {group.options.map((option) => (
                <GroupAction
                  key={option.id}
                  layout="icon"
                  label={`${group.label}: ${option.label}`}
                  glyph={icons[group.id][option.id]}
                  active={filters[group.id] === option.id}
                  aria-pressed={filters[group.id] === option.id}
                  onClick={() => onToggle(group.id, option.id)}
                />
              ))}
            </SurfaceGroup>
          ))}
        </div>
      </div>
      {edges.left && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-operational-surface to-transparent" />}
      {edges.right && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-operational-surface to-transparent" />}
    </div>
  );
}
