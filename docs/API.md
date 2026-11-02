<p align="center">
  <img src="../assets/readme/banners/react.png" alt="React" width="100%">
</p>

# Proxy do portal

O backend não exporta um OpenAPI próprio. A interface autenticada fica sob `/api/qa`.

| Caminho | Uso |
|---|---|
| `/services` | Identificadores permitidos |
| `/{id}/spec` | Contrato remoto ajustado para o proxy local |
| `/{id}/proxy/*` | Chamada ao caminho permitido no destino fixo |
| `/health` | Processo local, fora do prefixo e público |

O portal exige um Bearer JWT de QA, e alguns destinos recebem credenciais específicas do servidor, sem que as respostas sejam guardadas em cache. O limite de corpo e de resposta é de dez MiB, e o timeout de destino é de noventa segundos.

```http
GET /api/qa/services
Authorization: Bearer <access token de QA>
```

O proxy devolve erros próprios com `message`, e não o contrato ProblemDetail completo. A falta de credencial de destino produz 503, um destino desconhecido produz 404 e um caminho vedado produz 403, enquanto as falhas de upstream e os redirecionamentos bloqueados produzem 502, e as mutações nunca são repetidas automaticamente.