# 62 · Borda Celestial, a primeira feita de imagem

Uma borda nova na loja (veja [Bordas ornamentadas](60-bordas-ornamentadas.md)), feita em outubro de 2026 a partir de
uma imagem que o dono do site gerou. Custa **R$ 4,50**, como as outras; com ela, a loja tem **13 bordas**.

## A borda

**Celestial**: moldura dourada com arabescos, uma faixa azul com runas brilhando e uma estrela com a lua no canto de
cima à direita. Além da imagem, ela tem animação: a moldura ganha um brilho azul que vai e volta, e um brilho pisca
em cima da estrela.

## Como uma borda de imagem funciona

- A imagem fica em `public/bordas/celestial.webp`: 401 × 573 px, com o meio transparente, convertida do PNG enviado
  (`canvas.png`, 222 KB) para WebP (41 KB). O outro arquivo enviado (o `.jpeg`) não servia: o xadrez cinza e branco
  estava desenhado na imagem, sem transparência de verdade.
- A imagem vai na camada `.enfeite-da-borda` (a mesma das bordas ornamentadas), por cima da capa. Ela foi medida: o
  meio da faixa da moldura fica em cima da beira da capa, então a capa ocupa, na imagem, de x 32,5 a 368,5 e de y 36,5
  a 538,5 (336 × 502 px, quase 2:3). Por isso a camada tem `left: -9,67%`, `top: -7,27%`, `width: 119,35%` e
  `height: 114,14%` da capa. Metade da faixa fica por cima da beira da capa, e metade por fora.
- A estrela da imagem substitui a estrela do favorito, que fica escondida. O status e a nota ficam por cima da
  moldura, um pouco para dentro.
- Como a moldura passa uns 10% para fora da capa, duas capas vizinhas na Biblioteca com essa borda ficam com as
  molduras quase encostando.

### Para as próximas bordas de imagem

1. A imagem precisa ter **transparência de verdade** (PNG ou WebP), com o meio transparente.
2. Medir onde a capa deve ficar na imagem (de preferência no meio da faixa da moldura) e transformar em porcentagem,
   como acima.
3. Converter para WebP, pôr em `public/bordas/`, criar o item em `ITENS_DA_LOJA` e as regras `borda-{id}` no
   `app.css` (incluindo o id na lista das bordas ornamentadas).

As medidas recomendadas para desenhar estão na conversa que originou esta doc: tela de 720 × 1020 px, janela da capa
de 600 × 900 px a partir de (60, 60), moldura de ~15 px e o meio transparente.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | A borda Celestial |
| `public/bordas/celestial.webp` | Novo: a imagem da moldura |
| `public/app.css` | A Celestial na lista das bordas ornamentadas e as regras dela |

## Como foi testado

Na loja e na Biblioteca, com a Celestial equipada: a moldura ficou centrada na capa (na primeira tentativa ela saiu
deslocada para a direita e para baixo, porque a regra geral das bordas ornamentadas ganhava da posição; corrigido
deixando a regra da Celestial mais específica). Os 85 testes da versão JavaScript passam.
