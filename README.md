# Solaria Sandbox

Interface de testes manuais do ambiente de QA. Login pela API-auth, seguido de layout e componentes consumidos diretamente de `@solaria.network/web-lib`. O web-app mantém seus componentes locais.

## Executar localmente

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5174. Use uma conta do QA. As variáveis de `.env.example` podem ser copiadas para `.env.local`; são URLs públicas, sem credenciais de serviço. Alterações de variáveis exigem reiniciar o Vite. Os destinos padrão são os serviços de QA no Render. Serviços locais podem substituir essas URLs durante o desenvolvimento.

O catálogo usa os hosts de QA documentados (Render) e, para PROD, o padrão `https://<servico>.solarianetwork.site`. Qualquer URL pode ser sobrescrita com `VITE_QA_<SERVICO>` ou `VITE_PROD_<SERVICO>` (nome do serviço em maiúsculas e com `_`, por exemplo `VITE_PROD_API_CORE`). A disponibilidade depende do ambiente: o cluster de PROD pode estar desligado e o Swagger pode estar desativado pelo próprio serviço.

## Modo mock (local, sem dependência externa)

Com `VITE_MOCKS=ALWAYS` (padrão do `.env.example`) e só no `npm run dev`, o login aceita qualquer e-mail e senha, cria uma sessão local e não chama a API-auth: renovação e logout também ficam locais. Nada é simulado além da autenticação, então as telas que consultam as APIs de QA continuam chamando os serviços reais e, sem um JWT válido, tendem a retornar 401. Para usar a autenticação real, defina `VITE_MOCKS=DEACTIVATED`. Builds de produção ignoram essa variável.

## Telas

- Catálogo: página inicial com todos os repositórios do Solaria (exceto Elos) e filtros em pílulas de ícones, como as do login: framework (Spring, LangChain, FastAPI, React), linguagem (Python, Kotlin, Java, TypeScript, Terraform) e tipo (serviços, bibliotecas, infraestrutura, dados, documentação, mobile). Clicar em um ícone liga o filtro e clicar de novo desliga; os filtros se combinam e ficam na URL. Cada repositório mostra o GitHub e, quando tem Swagger, as opções PROD e QA com abrir em nova aba e copiar o link. Serviços sem Swagger mostram os links da aplicação em QA e PROD. A linha `storybook` aponta para o GitHub Pages (`VITE_STORYBOOK_WEB_APP` e `VITE_STORYBOOK_LIB_WEB` sobrescrevem as URLs).
- Keepalive: acorda os serviços de QA no Render com uma requisição simples (`no-cors`, sem integrar o serviço de keepalive). Há um botão por serviço, conjuntos predefinidos (Essenciais, IA e Todos) e seleção múltipla. A resposta indica só que o serviço respondeu; o plano free pode levar cerca de um minuto para acordar. Aplicações estáticas (web-app e web-sandbox) não dormem e ficam de fora.
- Fluxo de IA: reservado e comentado em `src/App.tsx` (rota, item de menu e import). Será implementado por outra pessoa.

As telas de teste manual por serviço (API-core, API-messenger, serviços de IA e demais) foram removidas; o catálogo concentra os links de cada serviço. A sessão fica só em memória, com logout local imediato.

## Biblioteca de componentes

`@solaria.network/web-lib` vem do npm, no intervalo `^0.5.0` (correções e novidades compatíveis da 0.5.x). O `package-lock.json` fixa a versão exata e o Dependabot abre as PRs de atualização.

Para testar uma alteração da lib antes de publicá-la, gere o tarball na lib (`npm run build` e `npm pack`) e instale-o localmente com `npm install ./caminho/solaria.network-web-lib-x.y.z.tgz`, sem commitar o tarball.

## Validação

```sh
npm test
npm run lint
npm run build
```

Os testes usam respostas controladas e não alteram QA. Nenhum BFF é utilizado, e nenhuma chave interna deve ser adicionada a variáveis `VITE_*`.
