<p align="center">
  <img src="../assets/readme/banners/react.png" alt="React" width="100%">
</p>

# Acesso ao portal

A sessão real de QA autoriza o uso do proxy.

```mermaid
flowchart TD
 A[Pessoa entra no catálogo] --> B[Login no api-auth]
 B --> C[Recebe sessão]
 C --> D[Abre Swagger em nova aba]
 D --> E[Fornece JWT por canal validado]
 E --> F[Backend valida JWT e encaminha chamada]
```

Um token inválido impede o uso do proxy, e uma sessão de mock local não concede acesso aos serviços. O fluxo central está em [LOGIN_AND_TOKEN.md](https://github.com/Solierrr/docs-warehouse/blob/main/docs/flows/LOGIN_AND_TOKEN.md).