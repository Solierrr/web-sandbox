import { useState } from "react";
import { Input, OperationalPage } from "@solaria.network/web-lib";
import repositories from "../../../config/repositories.json";
import { tools, services, externalUrl } from "../../../config/services";
export default function RepositoriesPage() {
  const [query, setQuery] = useState("");
  const groups = new Map<string, typeof repositories>();
  repositories
    .filter((repo) =>
      `${repo.name} ${repo.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .forEach((repo) => {
      const prefix = repo.name.includes("-")
        ? repo.name.split("-")[0]
        : "outros";
      groups.set(prefix, [...(groups.get(prefix) || []), repo]);
    });
  return (
    <OperationalPage
      title="Atalhos do ambiente"
      description="Repositórios, serviços e ferramentas do Solaria."
      centered
      sideBackground
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-10">
        <section className="grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <article
              key={tool.name}
              className="rounded-hard border border-operational-border bg-white p-5"
            >
              <h2>{tool.name}</h2>
              <p className="my-3 text-sm text-gray">{tool.description}</p>
              {externalUrl(tool.url) ? (
                <a
                  href={externalUrl(tool.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange"
                >
                  Abrir {tool.name} ↗
                </a>
              ) : (
                <p className="text-sm text-gray">
                  URL pendente de configuração.
                </p>
              )}
            </article>
          ))}
        </section>
        <Input
          name="repository-search"
          placeholder="Buscar repositório ou finalidade"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          icon={{ name: "search" }}
          className="w-full"
        />
        {[...groups]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([prefix, repos]) => (
            <section key={prefix}>
              <h2 className="mb-4 text-lg font-semi-bold">
                {prefix === "outros" ? "Outros" : `${prefix}-`}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {repos.map((repo) => {
                  const service = services.find(
                    (item) => item.id === repo.name,
                  );
                  return (
                    <article
                      key={repo.name}
                      className="flex flex-col gap-3 rounded-hard border border-operational-border bg-white p-5"
                    >
                      <h3 className="font-semi-bold">{repo.name}</h3>
                      <p className="flex-1 text-sm text-gray">
                        {repo.description ||
                          (repo.name === "mocks-warehouse"
                            ? "Acervo compartilhado de imagens para mocks e seeds."
                            : repo.name === "docs-reports"
                              ? "Relatórios e registros do projeto."
                              : "Configurações e recursos compartilhados.")}
                      </p>
                      {repo.name.startsWith("elos-") && (
                        <p className="text-xs text-gray">Projeto Elos</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange"
                        >
                          GitHub ↗
                        </a>
                        {service && externalUrl(service.url) && (
                          <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Serviço QA ↗
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        {!groups.size && <p>Nenhum repositório encontrado.</p>}
      </div>
    </OperationalPage>
  );
}
