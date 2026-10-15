# 32 · Filtro de tag na Biblioteca

Mudança feita em outubro de 2026 na lista **Todos os mangás** da Biblioteca.

## O que motivou

Para ver só os mangás de uma tag, era preciso abrir um mangá e clicar na tag dele. O pedido foi um filtro de tags ao
lado da ordenação.

## Como ficou

- Ao lado do seletor de ordem há o seletor **"Todas as tags"**, com as tags que estão em algum mangá da Biblioteca e
  quantos mangás têm cada uma, das mais usadas para as menos: "Action (9)", "Fantasy (6)"…
- Escolher uma tag mostra só os mangás dela. O seletor fica com a borda destacada, para lembrar que a lista está
  filtrada. "Todas as tags" volta a mostrar tudo.
- O filtro de tag funciona junto com a **busca**, os **filtros de status**, a **ordem** e as **páginas**.
- O endereço acompanha (`#/tag/{nome}`), sem recarregar a tela.
- Clicar numa tag na página de um mangá abre a lista com aquela tag já escolhida no seletor. Isso substituiu o botão
  "Tag: … ×" que aparecia antes nos filtros de status.
- No celular, o seletor de tag fica numa linha própria, embaixo da busca.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Seletor de tag na barra da lista; o botão "Tag: … ×" saiu |
| `public/app.css` | Largura e destaque do seletor de tag |

Não houve mudança no servidor: as tags vêm de `GET /api/tags` e o filtro é o mesmo de antes (`tag`).

## Testes

Conferido em um navegador com 15 mangás: as tags com as quantidades; Romance mostrando 6; Romance com Lendo mostrando
3; somado à busca; voltar a "Todas as tags" (15); chegar pela tag Fantasy da página de um mangá com o seletor já em
Fantasy; e o celular, sem rolagem para o lado. Não há teste automático.
