# 94 · "Com tags em comum" e "recomendados" encaixados

Na página do mangá ([doc 93](93-pagina-do-manga-no-meio.md)), as seções "Na sua lista, com tags em comum" e as
recomendações mostram até 6 obras cada. Com a página mais estreita (até 940 px), a grade comum do site (colunas de
pelo menos 150 px) cabia só 5 por linha, e a sexta ficava sozinha embaixo.

Agora essas duas seções têm a grade própria:

- **Computador:** 6 colunas, todas as obras numa linha só, com as capas um pouco menores (cerca de 145 px) e o título
  em 13 px.
- **Telas até 780 px (e celular):** 3 colunas, duas linhas de 3, sem obra sobrando.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | A grade de 6 (ou 3) colunas das seções da página do mangá |

## Como foi testado

No navegador, num mangá com 6 outros da lista com tags em comum: a 1550 px, as 6 capas numa linha; a 390 px, duas
linhas de 3. Os 101 testes passam e o site compactado foi conferido.
