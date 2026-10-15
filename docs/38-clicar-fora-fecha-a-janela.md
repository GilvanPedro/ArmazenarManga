# 38 · Clicar fora fecha a janela

Mudança feita em outubro de 2026 em todas as janelas flutuantes do site.

## O que mudou

Clicar fora de uma janela flutuante, no fundo escurecido, agora é o mesmo que fechá-la: faz o que o **Esc** (e o **×**)
daquela janela faz. Vale para todas:

- a janela de escrever um post e a de montar a lista;
- a lista publicada: com um mangá aberto, clicar fora **volta para a lista**, como o × e o Esc
  (veja [Detalhe da lista sem status](35-detalhe-da-lista-sem-status.md)); com a lista aberta, fecha a janela;
- as confirmações (por exemplo, apagar um post): clicar fora conta como **Cancelar**;
- as janelas da Biblioteca (capítulo, reler) e a imagem grande.

Só fecha se o clique **começar e terminar fora** da janela: selecionar um texto dentro dela e soltar o mouse fora não
fecha nada. Clicar num espaço vazio dentro da janela também não fecha.

## Como funciona

Um único par de ouvintes no `document` (`pointerdown` e `click`) vê quando o clique caiu no próprio `<dialog>` e fora
da caixa dele (o fundo pertence ao `<dialog>`). Aí ele dispara o evento `cancel` da janela, o mesmo que o Esc dispara;
se nenhuma janela impedir, ela fecha. Assim cada janela reaproveita o que já fazia no Esc, sem código próprio.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `foraDaJanela` e os ouvintes de `pointerdown`/`click` que fecham a janela ao clicar fora |

## Testes

Conferido em um navegador: lista publicada com mangá aberto (volta à lista) e na grade (fecha); clicar no canto vazio
dentro da janela não fecha; janela de escrever fecha; montar a lista fecha e a de escrever continua aberta;
confirmação de apagar cancela e o post continua; arrastar de dentro para fora não fecha; janela de capítulo da
Biblioteca fecha. Não há teste automático.
