# 80 · Banner vertical recomendado: 400 × 1280

Ajuste feito em outubro de 2026 no cadastro dos banners (veja [Banners de anúncio: cadastro e relatórios](76-banners-de-anuncio.md)):
o tamanho recomendado do banner **vertical** passou a ser **400 × 1280 px**, o espelho do horizontal (1280 × 400).

- Esse tamanho **já era aceito** (a altura dele é 3,2 vezes a largura, dentro da regra de 1,5 a 5 vezes); o que mudou
  foi a recomendação mostrada na janela de cadastro e nas mensagens de erro: agora "400 × 1280, 300 × 600 ou 160 × 600".
- As regras do formato vertical continuam as mesmas: largura de 100 a 2000 px, altura de 250 a 4000 px, e a altura de
  1,5 a 5 vezes a largura.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | 400 × 1280 como o primeiro exemplo do formato vertical |
| `test-api/banners.test.mjs` | 400 × 1280 entre os tamanhos verticais conferidos |

## Como foi testado

Os 95 testes da versão JavaScript passam, com 400 × 1280 aceito como banner vertical.
