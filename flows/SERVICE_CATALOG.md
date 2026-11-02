<p align="center">
  <img src="../assets/readme/banners/react.png" alt="React" width="100%">
</p>

# Documentação de serviço

A pessoa seleciona um serviço permitido e usa seu contrato pelo proxy de QA.

```mermaid
sequenceDiagram
 participant N as Swagger
 participant P as Portal
 participant S as Serviço
 N->>P: Contrato com JWT
 P->>S: Busca OpenAPI no destino fixo
 S-->>P: Contrato
 P-->>N: Contrato com servidor local
 N->>P: Operação autenticada
 P->>S: Chamada com credencial apropriada
 S-->>N: Resposta pelo portal
```

Referência externa, destino arbitrário e rota interna são bloqueados. Uma resposta que reflita credenciais injetadas também é recusada.
