# 36 · Post aberto em tela própria

Mudança feita em outubro de 2026 na Comunidade (veja [Comunidade](28-comunidade.md)).

## O que mudou

- **Clicar num post abre o post**, como no Twitter: clicar em qualquer parte do post no feed (fora dos botões, links,
  imagens e da lista) ou no **💬** abre uma tela só dele, em `#/comunidade/post/{id}`.
- **Post maximizado.** Nessa tela o texto fica maior e os comentários aparecem embaixo do post, com o campo de comentar
  no alto deles. No topo fica o botão **←** e o título "Post".
- **Voltar devolve o feed como estava.** Ao abrir um post, a tela da Comunidade (os posts já carregados e a rolagem) é
  guardada. O **←**, o voltar do navegador e o gesto de voltar devolvem essa tela no mesmo ponto, sem recarregar o feed.
  O post que foi aberto volta atualizado (curtidas e comentários novos), ou some do feed, se foi apagado.
- Quem entra direto no endereço de um post (por um link) e clica em **←** vai para o feed.
- O navegador não restaura mais a rolagem sozinho (`history.scrollRestoration = 'manual'`); o próprio site cuida disso,
  para não pular para o lugar errado ao voltar.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `abrirPost`, `restaurarComunidade`, `voltarDoPost`; `cartaoDePost(post, {maximizado})`; `carregarComentarios` com o campo antes da lista; a rota `#/comunidade/post/{id}` devolve a tela guardada |
| `public/app.css` | `.post.clicavel`, `.post-aberto`, `.topo-do-post-aberto`, `.voltar-do-post` |

## Testes

Conferido em um navegador: abrir um post rolado no meio do feed e voltar (pelo ← e pelo voltar do navegador) devolve o
feed no mesmo ponto, com o post atualizado; comentar no post aberto; entrar direto pelo endereço e voltar ao feed. Não
há teste automático.
