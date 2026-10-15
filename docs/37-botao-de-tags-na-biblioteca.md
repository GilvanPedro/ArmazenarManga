# 37 · Botão de Tags na Biblioteca

Mudança feita em outubro de 2026 no filtro de tags da lista **Todos os mangás** (veja
[Tags da Biblioteca como no Descobrir](34-tags-da-biblioteca-como-no-descobrir.md)).

## O que mudou

- O quadro de tags, que ficava embaixo da busca ocupando espaço, virou um botão **🏷 Tags** ao lado da ordenação.
- Clicar no botão abre, flutuando por cima da lista, o mesmo quadro do Descobrir: pesquisa, as tags escolhidas e as
  tags dos mangás da Biblioteca. O mangá precisa ter todas as tags escolhidas, como antes.
- Com tags escolhidas, o botão fica destacado e mostra quantas são; passar o mouse mostra quais.
- **Clicar fora** do painel ou apertar **Esc** fecha o painel.
- Clicar numa tag na página de um mangá continua chegando à Biblioteca com ela escolhida, e o endereço continua
  acompanhando (`#/tag/{nome}`).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Biblioteca: botão `.botao-de-tags` e painel `.painel-de-tags` com o quadro de tags, fechando ao clicar fora ou com Esc |
| `public/app.css` | `.filtro-de-tags`, `.botao-de-tags`, `.quantas-tags`, `.painel-de-tags` |

## Testes

Conferido em um navegador: o botão sem tags ("🏷 Tags"), escolher uma tag no painel (o botão passa a mostrar 1),
fechar clicando fora e com Esc. Não há teste automático.
