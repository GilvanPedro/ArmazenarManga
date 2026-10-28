# 137 · Repost, citação e quem curtiu

Três novidades na Comunidade, no jeito do X (antigo Twitter).

## Quem curtiu

Ao abrir o **próprio** post, aparece ao lado da lixeira o botão **👥 Quem curtiu** (no celular, só o ícone). Ele abre
uma janela com as pessoas que curtiram, das mais recentes para as mais antigas, cada uma com o botão de seguir e o link
para o perfil (a mesma janela da lista de seguidores).

Só quem escreveu o post vê essa lista: o servidor recusa o pedido de qualquer outra pessoa ("Só quem escreveu o post
vê quem curtiu").

## Repost e citação

Todo post ganhou o botão **🔁** com o número de reposts e citações. Ele abre um menu com duas opções:

- **Repostar:** o post passa a aparecer no feed de quem segue você e no seu perfil, com "🔁 Fulano repostou" em cima
  (para você, "Você repostou"). Curtir, comentar e repostar a partir dele vale para o post original. O botão fica
  verde e o menu passa a mostrar **Desfazer o repost**; desfeito, o repost some do feed.
- **Citar:** abre a janela de escrever com o post citado embaixo do texto. Você escreve (pode pôr imagens ou uma
  lista) e publica um post novo, com o original dentro, menor. Clicar no citado abre ele.

Vale para posts seus e de outras pessoas. Repostar ou citar um repost é repostar ou citar o post original. Cada pessoa
reposta um post uma vez só.

### No feed

- O mesmo post não aparece duas vezes: o original e os reposts dele (de várias pessoas) contam como um só, e fica o
  que aparece primeiro.
- O número de posts do perfil e o "Quem seguir" não contam os reposts, só os posts escritos.

### Quando o original é apagado

- Os reposts dele somem junto.
- As citações continuam, mostrando "Este post foi apagado." no lugar do citado.

## Por dentro

- Banco: `posts.repost_de` (o post repostado ou citado) e `posts.so_repost` (é só o repost, sem texto). Sem chave
  estrangeira de propósito, para apagar o original não apagar as citações. Um índice único impede repostar o mesmo
  post duas vezes.
- API: `POST` e `DELETE /api/comunidade/posts/{id}/repost`; `POST /api/comunidade/posts` aceita `citando`;
  `GET /api/comunidade/posts/{id}/curtidas` (só o dono).
- Cada post devolvido traz `reposts`, `repostei`, `citado` (o post citado, ou `{apagado: true}`) e, num repost,
  `repostadoPor`.
- O menu do repost fica no corpo da página, preso ao botão (para não ser cortado pelo post), e fecha ao escolher,
  clicar fora, apertar Esc ou rolar.

## Testado

Com duas contas: a Mei publica, o Kai curte, reposta e cita; o repost não duplica; só a Mei vê quem curtiu; no feed
do Kai o post da Mei aparece uma vez; o perfil não conta o repost; citar pela janela, desfazer o repost (o card some) e
apagar o original (o repost some, as citações mostram "apagado"). No Firefox e no Chrome, no computador e no celular
(360 e 390 px: os cinco botões do post aberto cabem).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade.js` | `validarPost` aceita `citando` |
| `api/_comunidade_rotas.js` | As colunas novas, reposts e citados em `postsPorIds`, `semRepetir` no feed, as rotas de repost e de quem curtiu |
| `public/app.js` | O botão e o menu de repost, `citarPost`, `postCitado`, `janelaDeCurtidas` e o "Fulano repostou" |
| `public/app.css` | O menu, o post citado, o cabeçalho do repost e os botões no celular |
| `test-api/comunidade.test.mjs` | O teste do `citando` |

> Os emojis dos botões viraram ícones de linha: veja [doc 138](138-icones-no-lugar-dos-emojis.md).
