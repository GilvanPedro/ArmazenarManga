# 105 · A página inicial abre o site, sem pedir conta

Depois do [doc 104](104-site-aberto-sem-conta.md), quem chegava sem conta ainda caía na tela de entrar, e tinha que
clicar em "Continuar sem conta" para ver o site. Agora a **página inicial já abre o site**: em cima, as **boas-vindas**
(o que é o Viracap, "Criar conta grátis", "Entrar" e "Ver a Comunidade") e, embaixo, o **Descobrir**, com as obras
mais populares, a busca e as tags. A tela de entrar ou de criar conta só aparece quando a pessoa:

- clica em **Entrar** ou **Criar conta** (no topo ou nas boas-vindas);
- faz algo que precisa de conta (cadastrar, postar, curtir, comentar, seguir, abrir uma lista, ver os mangás de um
  leitor, comprar, a Mochila, o Seguindo, Lançam hoje, a página de um mangá…), como no doc 104.

O "Continuar sem conta" da tela de entrar volta para a tela onde a pessoa estava (ou para a página inicial). Com conta,
a página inicial continua sendo a Biblioteca.

A página inicial sem conta tem o título completo do site e o h1 "Sua lista de mangás, manhwas e manhuas", que é o
que o Google mostra.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `boasVindas()`; a página inicial sem conta abre `telaDescobrir(true)`; o "Continuar sem conta" volta para a tela certa |
| `public/app.css` | As boas-vindas |

## Como foi testado

No navegador, sem conta, no computador e no celular: o site abriu direto nas boas-vindas com as obras do Descobrir,
sem a tela de entrar. "+ Adicionar" de uma obra levou para criar conta com o motivo; "Continuar sem conta" voltou para
a página inicial; o botão Entrar do topo abriu a tela de entrar. Com conta, a página inicial continuou a Biblioteca.
Os testes passam.
