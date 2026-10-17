# 71 · Meteoros no tema Galáxia

Ajuste no tema animado Galáxia (`cosmos`, veja [Temas animados Galáxia e Fazenda](69-temas-galaxia-e-fazenda.md)),
feito em outubro de 2026: além das nebulosas girando e das estrelas piscando, **meteoros** passam de vez em quando.

## Como é

- Dois meteoros, cada um com uma cabeça brilhante e um rastro que some para trás, com um brilho em volta (lilás num,
  azul no outro).
- Ficam apagados a maior parte do tempo e, **de vez em quando, cruzam a tela descendo na diagonal**: o primeiro a
  cada 11 segundos, o segundo a cada 17, em ângulos diferentes (24° e 34°) e fora de tempo um do outro, então nunca
  passam juntos do mesmo jeito.
- Passam atrás de tudo, como o resto do fundo: aparecem nos espaços entre os painéis e através deles (que são meio
  transparentes nesse tema).
- Quem pede para o sistema reduzir animações não vê os meteoros.

## Como funciona

- Na página, as duas camadas do `<body>` já eram a nebulosa e as estrelas; os meteoros usam as duas do `<html>`
  (`:root::before` e `:root::after`), paradas na tela e atrás de tudo.
- Na prévia da loja e na janela dos mangás do perfil (que mostram o tema da pessoa), entraram mais duas camadas,
  `.fundo-da-previa-3` e `.fundo-da-previa-4`, com as mesmas regras.
- O risco de cada meteoro é o fundo da camada; quem anda é a camada inteira, girada no ângulo do meteoro (`--angulo`),
  o que o navegador faz sem redesenhar a página.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Os meteoros da Galáxia e as camadas novas da prévia e da janela |
| `public/app.js` | As camadas `.fundo-da-previa-3` e `.fundo-da-previa-4` na prévia dos temas e na janela dos mangás do perfil |

## Como foi testado

No navegador, com a Galáxia equipada na Comunidade e a animação parada no meio da passagem (só para a captura): os
dois meteoros apareceram descendo na diagonal, com a cabeça brilhante e o rastro, atrás dos painéis; a prévia da loja
também. Numa primeira versão eles subiam e eram finos demais; o ângulo foi invertido e o rastro ficou mais grosso e
mais claro. Os 87 testes da versão JavaScript passam.
