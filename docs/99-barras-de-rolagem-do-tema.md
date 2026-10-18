# 99 · Barras de rolagem na cor do tema

Em telas de computador (com as barras de rolagem clássicas, como no Windows), apareciam as barras cinza do navegador
na página e em algumas caixas (o código do atalho, tabelas, listas de tags). A pedido do dono, todas as barras do site
passaram a ser **finas e na cor de destaque do tema equipado**, sobre um trilho transparente:

- no tema Escuro, laranja; no Synthwave, rosa; no Fazenda, laranja-escuro; e assim por diante;
- passando o mouse, a barra fica na cor cheia (nos navegadores que usam `::-webkit-scrollbar`);
- a rolagem continua igual; só o desenho da barra muda;
- as abas continuam sem barra nenhuma ([doc 41](41-comunidade-mais-larga.md));
- a janela que mostra a lista de outra pessoa com o tema dela usa a cor do tema dela.

## Como funciona

`scrollbar-width: thin` e `scrollbar-color` (a cor de destaque com 55% de opacidade e o trilho transparente) em todos
os elementos, que valem no Firefox e no Chrome, Edge e Opera atuais; e `::-webkit-scrollbar` (8 px, ponta
arredondada) para o Safari e navegadores mais antigos.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | As barras de rolagem do site todo na cor do tema |

## Como foi testado

No navegador com as barras de rolagem visíveis, a 1550 × 770, nos temas Escuro, Claro, Synthwave e Fazenda: a barra da
página fina e na cor de destaque de cada tema. Também foi conferido que nenhuma página rola para o lado e que os
banners não criam barra de rolagem onde não havia. Os testes passam.
