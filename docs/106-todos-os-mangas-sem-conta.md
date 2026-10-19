# 106 · "Todos os mangás" sem conta leva para criar conta

Sem conta, clicar na aba **Todos os mangás** (da Biblioteca) não fazia nada: o endereço dela é o da página inicial, e
sem conta a página inicial já é a das boas-vindas com o Descobrir ([doc 105](105-pagina-inicial-sem-conta.md)). Clicar
no endereço em que a pessoa já está não muda nada.

Agora, sem conta, essa aba abre a tela de **criar conta** com o motivo "Crie uma conta para ter a sua lista de
mangás.", de qualquer aba (página inicial, Descobrir ou Extensão e atalho). As outras abas continuam como antes:
Lançam hoje pede conta, Descobrir e Extensão abrem. Com conta, "Todos os mangás" abre a Biblioteca, como sempre.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Em `abas()`, sem conta, "Todos os mangás" chama `exigirConta` |

## Como foi testado

No navegador, sem conta: "Todos os mangás" na página inicial, no Descobrir e na Extensão abriu criar conta com o
motivo; "Lançam hoje" continuou pedindo conta. Com conta, "Todos os mangás" abriu a Biblioteca. Os testes passam.
