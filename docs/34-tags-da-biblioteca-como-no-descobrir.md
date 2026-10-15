# 34 · Tags da Biblioteca como no Descobrir

Mudança feita em outubro de 2026 no filtro de tags da lista **Todos os mangás**, que tinha virado um seletor em
[Filtro de tag na Biblioteca](32-filtro-de-tag-na-biblioteca.md).

## O que motivou

O pedido foi deixar o filtro no estilo da aba Descobrir, só com o quadro das tags que se quer ver (sem o de "não
quero").

## Como ficou

No lugar do seletor, embaixo da busca, fica o quadro **"Tags que quero ver"**, o mesmo do Descobrir (veja
[Filtro de tags no Descobrir](13-filtro-de-tags-no-descobrir.md) e
[Recolher as tags no Descobrir](14-recolher-tags-no-descobrir.md)):

- campo para **pesquisar a tag pelo nome** (Enter marca a primeira encontrada);
- as tags escolhidas em cima, com **×** para tirar, e **Limpar** para tirar todas;
- a lista de tags (as que estão em algum mangá da Biblioteca), que começa **recolhida** e abre ao pesquisar ou pelo
  botão "Mostrar tags".

Agora dá para escolher **várias tags**: aparecem os mangás que têm **todas** elas. O filtro continua funcionando junto
com a busca, os status, a ordem e as páginas. O endereço acompanha (`#/tag/Fantasy/Action`), e clicar numa tag na
página de um mangá abre a lista com ela já escolhida.

## O que mudou no servidor

A lista (`GET /api/mangas`) passou a aceitar **várias tags**, repetindo o parâmetro: `?tag=Action&tag=Fantasy` (até 10).
O mangá precisa ter todas. Uma tag só continua funcionando como antes. Isso foi feito nas duas versões do servidor e
vale para contas grandes, em que a lista é filtrada pelo servidor.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js`, `public/app.css` | Quadro de tags no lugar do seletor; várias tags na lista guardada e nas páginas do servidor |
| `api/index.js` | `tag` repetido na lista |
| `repository/ConsultaDeMangas.java`, `PostgresMangaRepository.java`, `web/ApiServer.java` | Várias tags na consulta da lista |

## Testes

- Java (290 no total): duas tags ao mesmo tempo pela rota, e a lista do banco igual à feita em memória com duas tags,
  em todas as ordens.
- No navegador, com 15 mangás: o quadro começa recolhido; pesquisar abre e Enter marca; Fantasy (9), Fantasy e Action
  (6), somado ao status Lendo (2); recolher mantendo as escolhidas; Limpar; chegar pela tag de um mangá; e o celular.
