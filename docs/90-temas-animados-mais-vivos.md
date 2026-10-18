# 90 · Temas animados mais vivos

O dono achou os temas animados parados demais. Os nove ganharam animações mais rápidas e constantes, e quase todos
ganharam uma camada nova (usando as camadas `:root::before` e `:root::after`, que só a Galáxia e os temas do
[doc 87](87-temas-entardecer-festival-e-pagina-de-manga.md) usavam).

| Tema | O que ficou mais rápido | O que é novo |
|------|-------------------------|--------------|
| Aurora | As luzes andam em 13 s (eram 24 s) | Uma cortina de luz em faixas balançando (6 s) e estrelas piscando no alto |
| Noite estrelada | As estrelas piscam em 3,5 s (eram 5 s) | O céu anda devagar, e duas estrelas cadentes cruzam a cada 5 e 7 s |
| Sakura ao vento | As pétalas caem em 9 e 14 s (eram 14 e 22 s) | Uma terceira camada de pétalas maiores e mais perto, caindo em 6,5 s |
| Galáxia | A nebulosa gira em 45 s (eram 90 s); meteoros a cada 6 e 9 s (eram 11 e 17 s, com 70% do tempo apagados, agora 40%) | – |
| Fazenda | As nuvens passam em 32 s (eram 60 s) | Um bando de pássaros batendo as asas e raios de sol girando em volta do sol |
| Synthwave | – | Estrelas piscando no céu e uma estrela cadente rosa a cada 6 s |
| Entardecer | As nuvens em 55 s (eram 150 s); o avião a cada 13 s (eram 28 s) e o rastro fica mais tempo | Um bando de pássaros cruzando o céu, batendo as asas (o sol foi para a camada da cidade) |
| Festival de Verão | Fogos a cada 5 e 7 s (eram 9 e 13 s, com 55% do tempo apagados, agora 22%); as lanternas balançam mais e em 2,6 s | – |
| Página de Mangá | A retícula passeia em 16 s (eram 40 s) | Linhas de ação num quadrinho, tremendo como num desenho de impacto |

## Como funciona

- Os pássaros são um SVG com os dois quadros (asas para cima e para baixo) lado a lado; o fundo pula de um para o
  outro a cada 0,25 s, e a camada atravessa a tela. As medidas usam `cqw` e `cqh`: na página, sem container, valem a
  tela; na prévia da loja (que é um container), valem a prévia.
- As estrelas cadentes usam a mesma animação dos meteoros da Galáxia.
- Continua tudo atrás do conteúdo, com `transform` e `opacity` (o navegador só move as camadas). Quem prefere menos
  movimento vê tudo parado, sem as estrelas cadentes, o avião e os fogos.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Os tempos das animações e as camadas novas dos temas |

## Como foi testado

Numa página de teste com o `app.css` do site, o tema no `<html>`, cartões falsos e a prévia da loja: os nove temas,
com os quadros parados em momentos escolhidos (as estrelas cadentes no meio do caminho, os fogos abertos, os pássaros
cruzando), conferindo também a lista das animações rodando em cada tema. O site compactado também foi conferido.

> Depois, as animações foram reescritas para pesar muito menos no processador: veja [O site muito mais leve para o processador](100-site-muito-mais-leve.md).
