# 69 · Temas animados Galáxia e Fazenda

Dois temas de fundo animado novos na loja (veja [Temas do site](67-temas-do-site.md)), feitos em outubro de 2026. Custam
**R$ 7,50**, como os outros animados; com eles, a loja tem 11 temas à venda (5 de cor e 6 animados).

| Id | Nome | Como é |
|----|------|--------|
| `cosmos` | Galáxia | Escuro, com nebulosas roxas, azuis e rosas girando bem devagar (uma volta a cada 90 segundos) e estrelas piscando por cima; detalhes em lilás |
| `fazenda` | Fazenda | Claro: céu azul com nuvens passando devagar, o sol, morros verdes e uma cerca de madeira embaixo; detalhes em vermelho de celeiro |

- O id da Galáxia é `cosmos` porque `galaxia` já é o id da borda Galáxia (um id não pode servir para dois itens).
- Na Fazenda, só as nuvens andam (uma camada que se repete a cada 600 px e anda exatamente isso, então a volta não dá
  pulo); o sol, os morros e a cerca ficam parados. Uma primeira versão balançava os morros, mas a camada inclinada
  mostrava uma faixa na borda da tela.
- Como os outros temas, as cores valem para o site todo, as camadas do fundo ficam paradas na tela e atrás de tudo, e
  ficam paradas para quem pede para o sistema reduzir animações. As prévias da loja usam as mesmas regras.

Um tema "anime ecchi" foi pedido junto e não foi feito: é conteúdo sexualizado, num site com uma Comunidade aberta e
um robô que barra imagens explícitas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os temas Galáxia (`cosmos`) e Fazenda (`fazenda`) |
| `public/app.css` | As cores e os fundos animados dos dois |

## Como foi testado

Os 87 testes da versão JavaScript passam. No navegador, com a Galáxia equipada na Comunidade e a Fazenda na
Biblioteca, e as duas prévias na aba Temas da loja.

> Depois, a Galáxia ganhou meteoros passando de vez em quando: veja [Meteoros no tema Galáxia](71-meteoros-na-galaxia.md).

> Depois vieram os temas Entardecer, Festival de Verão e Página de Mangá: veja [Temas Entardecer, Festival de Verão e Página de Mangá](87-temas-entardecer-festival-e-pagina-de-manga.md).

> Depois, os temas animados ficaram mais rápidos e ganharam camadas novas: veja [Temas animados mais vivos](90-temas-animados-mais-vivos.md).
