# 87 · Temas Entardecer, Festival de Verão e Página de Mangá

Três temas animados novos na loja (R$ 7,50 cada, como os outros animados), com cenas típicas de anime e diferentes dos
que já existiam (Aurora, Noite estrelada, Sakura ao vento, Galáxia, Fazenda e Synthwave). O movimento é lento e fica
atrás de tudo.

## Entardecer (`entardecer`)

O pôr do sol dos animes do dia a dia: céu em degradê do roxo ao laranja, o sol baixo perto do horizonte (respirando
devagar), uma cidade ao longe e **postes com fios** contra o céu. Nuvens compridas, iluminadas por baixo, passam bem
devagar (150 s por volta), e de vez em quando **um avião risca o céu**: o rastro cresce atrás dele e se desfaz (a cada
28 s). Tema escuro, com destaque laranja.

## Festival de Verão (`matsuri`)

Uma noite de matsuri: céu azul-noite com estrelas piscando, um cordão de **lanternas de papel vermelhas** acesas
atravessando a parte de baixo da tela, balançando de leve, e **fogos de artifício** abrindo ao longe de vez em quando
(dois, em lugares, cores e tempos diferentes: dourado a cada 9 s e rosa a cada 13 s). Tema escuro, com destaque
vermelho-laranja.

As lanternas ficam embaixo porque, em cima, ficavam atrás da barra do topo, que tem alturas diferentes no computador
(59 px) e no celular (101 px).

## Página de Mangá (`pagina`)

O site vira uma página de mangá: papel off-white, tinta preta e o vermelho de carimbo nos destaques; as caixas ganham
uma **sombra de tinta dura** (deslocada, sem desfoque). No fundo, os **quadrinhos** da página a traço bem apagado, uma
**mancha de retícula** passeando devagar (40 s) e um **ドキドキ** (o som do coração batendo) só no contorno, no canto
de baixo, batendo como coração: tum-tum, pausa. Tema claro.

## Como funciona

- Cada tema usa as quatro camadas de fundo: `body::before`, `body::after`, `:root::before` e `:root::after` (na
  prévia da loja, `.fundo-da-previa`, `-2`, `-3` e `-4`).
- Os desenhos (a cidade, os postes e os fios; as lanternas; os quadrinhos) são SVGs dentro do próprio CSS. Os traços
  dos postes, fios e quadrinhos usam `vector-effect: non-scaling-stroke`, para não engrossar nem afinar com a tela.
- A prévia dos temas na loja virou um container (`container-type: size`), para o ドキドキ e o sol usarem `cqmin` e
  ficarem do tamanho certo na prévia; na página, sem container, `cqmin` vira a medida da tela.
- As camadas que se mexem usam só `transform` e `opacity` (com `will-change`). Quem prefere menos movimento vê tudo
  parado, sem o avião e os fogos.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os três temas |
| `public/app.css` | As cores e as camadas dos três temas; a prévia dos temas como container |

## Como foi testado

- Os 96 testes da versão JavaScript passam (inclusive o de ids que não se repetem).
- No navegador, com os quadros parados em momentos escolhidos (o avião no meio do rastro, os fogos abertos): os três
  temas na biblioteca, no computador e no celular, e as prévias na loja. O site compactado também foi conferido.
