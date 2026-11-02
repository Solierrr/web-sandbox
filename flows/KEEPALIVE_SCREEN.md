<p align="center">
  <img src="../assets/readme/banners/react.png" alt="React" width="100%">
</p>

# Contato com serviços de QA

O operador seleciona um conjunto e inicia contatos para reduzir o tempo de despertar.

```mermaid
flowchart TD
 A[Seleciona serviços] --> B[Envia contato no-cors]
 B --> C[Mostra andamento por destino]
 C --> D[Operador valida serviço depois]
```

Uma resposta opaca do navegador não comprova que o serviço está pronto, e as falhas ficam restritas ao destino afetado. A rotina agendada está documentada separadamente, no repositório de keepalive.