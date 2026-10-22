# 135 · "Sortear de novo" que fugia do clique no Firefox

## O defeito

No Firefox, clicar em **🎲 Sortear de novo** (no sorteio da Biblioteca e no do Descobrir) não fazia nada: no momento
do clique aparecia uma barra de rolagem dentro da janela do sorteio, os botões mudavam de lugar e o "Sortear de novo"
saía de baixo do mouse.

## Por quê

1. Todo botão do site desce 1 pixel enquanto está apertado (`.botao:active`, o efeito de "afundar").
2. A área do resultado (a capa, o nome e os botões) tinha a altura exata do conteúdo e rola quando não cabe
   (`overflow-y: auto`). Esse 1 pixel a mais bastava para o Firefox achar que não cabia e mostrar a barra de rolagem.
3. A barra ocupa uns 50 px de largura: os botões andavam para o lado, e ao soltar o mouse ele já não estava em cima do
   "Sortear de novo". Sem apertar e soltar no mesmo botão, não há clique.
4. Além disso, o texto trocava para "Sorteando…", mais curto, e o botão encolhia de 171 para 120 px, mexendo de novo
   nos vizinhos.

No Chrome a barra não aparecia (ele não conta o "afundar" como conteúdo passando da altura), por isso o defeito era
só do Firefox.

## A correção

- **Folga embaixo dos botões** (8 px): o botão apertado desce dentro dela, e a barra de rolagem não aparece mais.
- **Largura fixa enquanto sorteia:** o botão guarda a largura que tinha antes de virar "Sorteando…" e volta ao normal
  quando o próximo sorteado chega.

Testado no Firefox a 1280 × 720, 1366 × 650 e 390 × 760 (celular), na Biblioteca e no Descobrir: com o botão
apertado não aparece barra, ele mantém a largura e o próximo sorteado abre.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | A folga embaixo dos botões do resultado do sorteio |
| `public/app.js` | `sortearCom` mantém a largura do botão enquanto mostra "Sorteando…" |
