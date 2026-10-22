import { useSearchParams } from "react-router-dom";
import {
  AndroidIcon,
  FastAPIIcon,
  GitHubIcon,
  GroupAction,
  Icon,
  JavaIcon,
  KotlinIcon,
  LangChainIcon,
  OperationalPage,
  PythonIcon,
  ReactIcon,
  ServiceList,
  SpringIcon,
  StorybookIcon,
  SurfaceGroup,
  SwaggerIcon,
  TerraformIcon,
  TypeScriptIcon,
  type ServiceListItem,
} from "@solaria.network/web-lib";
import type { ReactNode } from "react";
import {
  entries,
  filterGroups,
  matches,
  storybooks,
  withPath,
  type CatalogEntry,
  type CatalogFilters,
  type FilterGroupId,
} from "../../../config/catalog";

const FILTER_ICON_SIZE = 22;
const LINK_ICON_SIZE = 18;
const filterIcons: Record<FilterGroupId, Record<string, ReactNode>> = {
  framework: {
    spring: <SpringIcon size={FILTER_ICON_SIZE} />,
    langchain: <LangChainIcon size={FILTER_ICON_SIZE} />,
    fastapi: <FastAPIIcon size={FILTER_ICON_SIZE} />,
    react: <ReactIcon size={FILTER_ICON_SIZE} />,
  },
  language: {
    python: <PythonIcon size={FILTER_ICON_SIZE} />,
    kotlin: <KotlinIcon size={FILTER_ICON_SIZE} />,
    java: <JavaIcon size={FILTER_ICON_SIZE} />,
    typescript: <TypeScriptIcon size={FILTER_ICON_SIZE} />,
    terraform: <TerraformIcon size={FILTER_ICON_SIZE} />,
  },
  kind: {
    service: <Icon name="server" size={FILTER_ICON_SIZE} />,
    library: <Icon name="package" size={FILTER_ICON_SIZE} />,
    infra: <Icon name="cloud" size={FILTER_ICON_SIZE} />,
    data: <Icon name="database" size={FILTER_ICON_SIZE} />,
    docs: <Icon name="book" size={FILTER_ICON_SIZE} />,
    mobile: <AndroidIcon size={FILTER_ICON_SIZE} />,
  },
};

function toItem(entry: CatalogEntry): ServiceListItem {
  const qaTag = entry.qaLabel ?? "QA";
  const github = {
    label: "GitHub",
    icon: <GitHubIcon size={LINK_ICON_SIZE} />,
    href: entry.github,
  };
  if (entry.swaggerPath) {
    const swagger = <SwaggerIcon size={LINK_ICON_SIZE} />;
    return {
      name: entry.id,
      description: entry.description,
      links: [
        github,
        { label: "Swagger PROD", icon: swagger, tag: "PROD", href: withPath(entry.prod, entry.swaggerPath) },
        { label: "Swagger QA", icon: swagger, tag: qaTag, href: withPath(entry.qa, entry.swaggerPath) },
      ],
    };
  }
  const app = <Icon name="globe" size={LINK_ICON_SIZE} />;
  return {
    name: entry.id,
    description: entry.description,
    links: [
      github,
      ...(entry.prod ? [{ label: "Aplicação PROD", icon: app, tag: "PROD", href: entry.prod }] : []),
      ...(entry.qa ? [{ label: `Aplicação ${qaTag}`, icon: app, tag: qaTag, href: entry.qa }] : []),
    ],
  };
}

const storybookItem: ServiceListItem = {
  name: "storybook",
  description: "Catálogo visual dos componentes, publicado no GitHub Pages.",
  links: storybooks.map((book) => ({
    label: `Storybook ${book.label}`,
    icon: <StorybookIcon size={LINK_ICON_SIZE} />,
    tag: book.label,
    href: book.href,
  })),
};

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const filters: CatalogFilters = {};
  for (const group of filterGroups) {
    const value = params.get(group.id);
    if (value && group.options.some((option) => option.id === value)) filters[group.id] = value;
  }
  const hasFilters = Object.keys(filters).length > 0;
  const items = [
    ...entries.filter((entry) => matches(entry, filters)).map(toItem),
    ...(!hasFilters || filters.framework === "react" ? [storybookItem] : []),
  ];

  function toggle(group: FilterGroupId, id: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (next.get(group) === id) next.delete(group);
        else next.set(group, id);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <OperationalPage
      title="Catálogo"
      description="Repositórios, Swagger e aplicações do Solaria. Use os filtros para refinar."
      centered
      sideBackground
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-10">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {filterGroups.map((group) => (
            <SurfaceGroup key={group.id} direction="horizontal" divided={false} role="group" aria-label={group.label}>
              {group.options.map((option) => (
                <GroupAction
                  key={option.id}
                  layout="icon"
                  label={`${group.label}: ${option.label}`}
                  glyph={filterIcons[group.id][option.id]}
                  active={filters[group.id] === option.id}
                  onClick={() => toggle(group.id, option.id)}
                />
              ))}
            </SurfaceGroup>
          ))}
        </div>
        <section aria-label="Resultados" className="w-full">
          {items.length > 0 ? (
            <ServiceList items={items} />
          ) : (
            <p className="text-center text-gray">Nenhum repositório com esses filtros.</p>
          )}
        </section>
      </div>
    </OperationalPage>
  );
}
