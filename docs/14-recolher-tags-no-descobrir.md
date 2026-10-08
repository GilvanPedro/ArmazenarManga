# 14 · Recolher as tags na aba Descobrir

Mudança feita em outubro de 2026 nos quadros de tags da aba **Descobrir**, criados na mudança descrita em
[Filtro de tags no Descobrir](13-filtro-de-tags-no-descobrir.md).

## O que motivou

Os dois quadros mostravam a lista de tags o tempo todo e ocupavam boa parte da tela antes dos resultados.

## O que mudou na tela

A lista de tags de cada quadro agora pode ser recolhida. Recolhido, o quadro mostra só o título, as tags já
marcadas e o campo de pesquisa.

- **Botão no canto do quadro.** "Mostrar tags ▾" abre a lista e "Esconder tags ▴" recolhe.
- **Os dois quadros andam juntos.** Abrir ou recolher um faz o mesmo com o outro, pelo botão de qualquer um deles.
- **Pesquisar abre.** Começar a digitar no campo de pesquisa de um quadro abre a lista dos dois. Apagar o texto
  não recolhe; só o botão recolhe.
- **Começa recolhido.** Ao abrir o site, as listas vêm recolhidas. A escolha vale enquanto a página está aberta,
  inclusive ao trocar de aba e voltar.
- **O que está marcado continua à vista.** As tags marcadas ficam em cima do quadro mesmo com a lista recolhida,
  com o × para tirar, e continuam valendo na busca.

## O que mudou no código

Só o front-end mudou; o servidor e a rota ficaram iguais.

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Estado `descobrir.tagsAbertas`, dividido pelos dois quadros, e o botão em `quadroDeTags` |
| `public/app.css` | Estilo do botão e da lista recolhida |

O botão informa o estado a leitores de tela com `aria-expanded`.

## Testes

Conferido em um navegador: estado inicial, abrir ao digitar em cada quadro, recolher e abrir pelo botão de cada
quadro, o foco continuar no campo ao abrir digitando, e o estado ao sair da aba e voltar. Não há teste
automático, como no resto do front-end.

## O que ficou de fora

- Recarregar o site volta as listas para recolhidas.
