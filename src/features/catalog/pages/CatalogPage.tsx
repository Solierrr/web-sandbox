import { useSearchParams } from "react-router-dom";
import qaServices from "../../../../shared/qa-services.json";
import { openSwagger } from "../../swagger/swagger.service";
import {
  Icon,
  OperationalPage,
  Surface,
  StorybookIcon,
  SwaggerIcon,
  notify,
} from "@solaria.network/web-lib";
import type { ReactNode } from "react";
import AndroidIcon from "@thesvg/react/android";
import FastAPIIcon from "@thesvg/react/fastapi";
import JavaIcon from "@thesvg/react/java";
import KotlinIcon from "@thesvg/react/kotlin";
import LangChainIcon from "@thesvg/react/langchain";
import NpmIcon from "@thesvg/react/npm";
import PythonIcon from "@thesvg/react/python";
import PyPIIcon from "@thesvg/react/pypi";
import RenderIcon from "@thesvg/react/render";
import GoogleCloudIcon from "@thesvg/react/google-cloud";
import MailpitIcon from "@thesvg/react/mailpit";
import ReactIcon from "@thesvg/react/react";
import SpringIcon from "@thesvg/react/spring";
import TerraformIcon from "@thesvg/react/terraform";
import TypeScriptIcon from "@thesvg/react/typescript";
import CatalogFilterCarousel from "./CatalogFilters";
import CatalogServices, { type CatalogAccess, type CatalogRepositoryItem } from "./CatalogServices";
import { groupByStack } from "./Catalog.utils";
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
const brandIconProps = { width: FILTER_ICON_SIZE, height: FILTER_ICON_SIZE, "aria-hidden": true, focusable: false } as const;
const LINK_ICON_SIZE = 20;
const linkIconProps = { ...brandIconProps, width: LINK_ICON_SIZE, height: LINK_ICON_SIZE };
const filterIcons: Record<FilterGroupId, Record<string, ReactNode>> = {
  framework: {
    spring: <SpringIcon {...brandIconProps} />,
    langchain: <LangChainIcon {...brandIconProps} />,
    fastapi: <FastAPIIcon {...brandIconProps} />,
    react: <ReactIcon {...brandIconProps} />,
  },
  language: {
    python: <PythonIcon {...brandIconProps} />,
    kotlin: <KotlinIcon {...brandIconProps} />,
    java: <JavaIcon {...brandIconProps} />,
    typescript: <TypeScriptIcon {...brandIconProps} />,
    terraform: <TerraformIcon {...brandIconProps} />,
  },
  kind: {
    service: <Icon name="server" size={FILTER_ICON_SIZE} />,
    library: <Icon name="package" size={FILTER_ICON_SIZE} />,
    infra: <Icon name="cloud" size={FILTER_ICON_SIZE} />,
    data: <Icon name="database" size={FILTER_ICON_SIZE} />,
    docs: <Icon name="book" size={FILTER_ICON_SIZE} />,
    mobile: <AndroidIcon {...brandIconProps} />,
  },
};

function hostingTarget(href: string | undefined, fallback: "GCP" | "Render") {
  const provider = href && new URL(href).hostname.endsWith(".onrender.com") ? "Render" : fallback;
  return { label: provider, href, icon: provider === "Render" ? <RenderIcon {...linkIconProps} /> : <GoogleCloudIcon {...linkIconProps} /> };
}

function toItem(entry: CatalogEntry): CatalogRepositoryItem {
  if (entry.id === "lib-web") {
    return {
      name: entry.id,
      github: entry.github,
      description: entry.description,
      links: [
        { label: "Abrir pacote no npm", icon: <NpmIcon {...linkIconProps} />, href: "https://www.npmjs.com/package/@solaria.network/web-lib" },
        { label: "Copiar comando de instalação", icon: <Icon name="copy" size={LINK_ICON_SIZE} />, copyText: "npm install @solaria.network/web-lib" },
      ],
    };
  }
  if (entry.id === "lib-ai") {
    return {
      name: entry.id,
      github: entry.github,
      description: entry.description,
      links: [
        { label: "Abrir pacote no PyPI", icon: <PyPIIcon {...linkIconProps} />, href: "https://pypi.org/project/solaria-lib/" },
        { label: "Copiar comando de instalação", icon: <Icon name="copy" size={LINK_ICON_SIZE} />, copyText: "pip install git+https://github.com/Solierrr/lib-ai.git" },
      ],
    };
  }
  const interfaces = [...(entry.interfaces ?? (entry.swaggerPath ? [{ kind: "swagger" as const, prod: withPath(entry.prod, entry.swaggerPath), qa: withPath(entry.qa, entry.swaggerPath) }] : []))];
  const hasSwagger = qaServices.some(service => service.id === entry.id);
  if (hasSwagger && !interfaces.some(tool => tool.kind === "swagger")) interfaces.unshift({ kind: "swagger" });
  if (interfaces.length) {
    return {
      name: entry.id,
      github: entry.github,
      description: entry.description,
      links: [],
      accesses: [...interfaces.flatMap<CatalogAccess>((tool) => tool.kind === "swagger" && hasSwagger ? [{
        id: "swagger-qa", label: "Swagger QA", icon: <SwaggerIcon size={LINK_ICON_SIZE} />, direct: true,
        links: [{ label: "Swagger QA", href: `/swagger.html?service=${entry.id}`, icon: <SwaggerIcon size={LINK_ICON_SIZE} />, onSelect: () => {
          try { openSwagger(entry.id); } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível abrir o Swagger."); }
        } }],
      }, ...(tool.prod ? [{ id: "swagger-prod", label: "Swagger PROD", icon: <GoogleCloudIcon {...linkIconProps} />, direct: true, links: [hostingTarget(tool.prod, "GCP")] }] : [])] : [{
        id: tool.kind,
        label: tool.kind === "swagger" ? "Swagger" : "Mailpit",
        icon: tool.kind === "swagger" ? <SwaggerIcon size={LINK_ICON_SIZE} /> : <MailpitIcon {...linkIconProps} />,
        links: [hostingTarget(tool.prod, "GCP"), hostingTarget(tool.qa, "Render")],
      }]), ...(entry.gallery ? [{ id: "gallery", label: "Galeria de e-mails", icon: <Icon name="book" size={LINK_ICON_SIZE} />, links: [{ label: "Galeria de e-mails", icon: <Icon name="book" size={LINK_ICON_SIZE} />, href: entry.gallery }], direct: true }] : [])],
    };
  }
  return {
    name: entry.id,
    github: entry.github,
    description: entry.description,
    links: [],
    accesses: [hostingTarget(entry.prod, "GCP"), hostingTarget(entry.qa, "Render")].filter((target) => target.href).map((target) => ({
      id: target.label.toLowerCase(), label: target.label, icon: target.icon, links: [target], direct: true,
    })),
  };
}

const storybookItem: CatalogRepositoryItem = {
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
  const stacks = groupByStack(entries.filter((entry) => matches(entry, filters)));
  const showStorybook = !hasFilters || filters.framework === "react";

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
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col items-center gap-6 px-6 pb-10">
        <CatalogFilterCarousel filters={filters} icons={filterIcons} onToggle={toggle} />
        <section aria-label="Resultados" className="flex w-full min-w-0 flex-col gap-6">
          {stacks.map((stack) => (
            <section key={`${stack.dimension}:${stack.id}`} aria-label={stack.label} className="flex min-w-0 items-start gap-4">
              <Surface title={stack.label} aria-hidden="true" className="size-16 shrink-0 rounded-full!" contentClassName="flex size-full items-center justify-center rounded-full!">
                {filterIcons[stack.dimension][stack.id]}
              </Surface>
              <div className="min-w-0 flex-1">
                <CatalogServices items={stack.entries.map(toItem)} />
              </div>
            </section>
          ))}
          {showStorybook && (
            <section aria-label="Storybook" className="flex min-w-0 items-start gap-4">
              <Surface title="Storybook" aria-hidden="true" className="size-16 shrink-0 rounded-full!" contentClassName="flex size-full items-center justify-center rounded-full!">
                <StorybookIcon size={FILTER_ICON_SIZE} />
              </Surface>
              <div className="min-w-0 flex-1">
                <CatalogServices items={[storybookItem]} />
              </div>
            </section>
          )}
          {!stacks.length && !showStorybook && (
            <p className="text-center text-gray">Nenhum repositório com esses filtros.</p>
          )}
        </section>
      </div>
    </OperationalPage>
  );
}
