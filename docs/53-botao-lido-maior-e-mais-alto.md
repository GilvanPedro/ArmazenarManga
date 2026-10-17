# 53 · Botão "Lido" maior e mais para cima

Ajuste na extensão (veja [Extensão e atalho](08-extensao-e-atalho.md)), feito em outubro de 2026, que levou a
extensão para a versão **1.4.2**.

## O problema

O botão **✓ Lido**, que a extensão mostra nos sites de leitura onde há mangá cadastrado, ficava no **canto inferior
direito** da página (14 px da borda) e era pequeno. Nesse canto muitos sites de leitura põem os próprios botões
(próximo capítulo, voltar ao topo, comentários), e o botão da extensão ficava por cima deles.

## O que mudou

- **Mais para cima:** o botão continua colado na borda direita (14 px), mas agora fica a **40% da altura da tela**
  a partir de baixo (`bottom: 40vh`), um pouco abaixo do meio. O canto de baixo fica livre para os botões do site.
- **Maior:** o texto passou de 13 px para **16 px** (em negrito mais forte), e o espaço em volta de 10×14 px para
  **14×20 px**; o "×" de esconder cresceu junto. Fica mais fácil de acertar, inclusive no celular.
- O resto continua igual: meio transparente até passar o mouse (ou focar pelo teclado), o "×" esconde o botão só
  naquela aba, e o estilo fica isolado do site (shadow DOM).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `extensao/conteudo.js` | Posição (`bottom: 40vh`) e tamanho do botão "Lido" |
| `extensao/manifest.json` | Versão 1.4.2 |

## Como foi testado

Numa página de teste com um botão do próprio site no canto inferior direito, com o código da extensão rodando no
Chromium, no computador (1400×800) e no celular (390×760): o "✓ Lido" aparece maior, na borda direita, um pouco
abaixo do meio da tela, sem cobrir o canto. Os pacotes foram gerados de novo com
`node ferramentas/empacotar-extensao.mjs` (versão 1.4.2).

Para publicar na Mozilla, envie o `extensao-firefox.zip` novo como uma nova versão (veja
[Empacotar a extensão](50-empacotar-a-extensao.md)).
