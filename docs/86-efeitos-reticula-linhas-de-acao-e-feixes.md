# 86 · Efeitos Retícula, Linhas de Ação e Feixes de Luz

Três efeitos novos na loja (R$ 2,50 cada), pensados para serem diferentes dos que já existiam (que são, na maioria,
partículas, como faíscas, neve, brasas, chuva, corações e confete, ou clarões, como holográfico, aura, raios, glitch e
CRT). Os três vêm da linguagem do mangá e do cinema e ficam nas beiradas ou bem leves, sem encher a capa.

## Retícula (`reticula`)

A trama de pontinhos da impressão de mangá (screentone). Duas tramas (pontos grossos e pontos finos entre eles)
aparecem nos cantos de baixo à esquerda e de cima à direita e somem em direção ao meio. A área com pontos avança e
recua devagar (6 s), como uma sombra de retícula que respira. Os pontos são claros e misturados com `overlay`, então
aparecem em capas claras e escuras.

## Linhas de Ação (`foco`)

As linhas de foco das cenas de impacto do anime (shuchusen), saindo do meio da capa. Duas camadas de linhas com
espaçamentos diferentes deixam o desenho irregular, como feito à mão; a máscara deixa o meio limpo e mostra só as
beiradas, e um contorno escuro bem fino faz as linhas aparecerem em capas claras. O ângulo pula de leve três vezes a
cada meio segundo, o tremido clássico dessas cenas.

## Feixes de Luz (`feixes`)

Raios de sol quentes saindo de um ponto acima do canto de cima à esquerda (fora da capa), cada um com uma largura,
somados com `screen` e sumindo para baixo e para a direita. Os raios balançam devagar (9 s, ida e volta) e a luz
respira junto.

## Como funciona

Como os outros efeitos, cada um é a camada `::before` da capa. As animações de ângulo e de alcance usam propriedades
registradas com `@property` (`--alcance-da-reticula`, `--angulo-do-foco` e `--angulo-dos-feixes`); navegador sem
`@property` mostra o efeito parado. Quem prefere menos movimento também vê os três parados.

## Também: o brilho da Celestial

Combinando a Celestial com os efeitos, apareceu que o brilho azul dela também esbranquiçava a beira da imagem do mangá
(o mesmo problema que as molduras do [doc 84](84-quatro-molduras-de-imagem.md) tinham). O brilho foi para uma cópia da
moldura sem o miolo, como nelas: na `canvas.png`, a capa ocupa 83,79% × 87,61%, começando em 8,10% e 6,37%.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os três efeitos |
| `public/app.css` | Os três efeitos; o brilho da Celestial sem o miolo |

## Como foi testado

- Os 96 testes da versão JavaScript passam (inclusive o de ids que não se repetem).
- No navegador, com quadros parados em momentos escolhidos das animações: os três numa capa escura e numa colorida da
  biblioteca, na loja (tema claro, por quem não tem os itens) e junto com bordas (Celestial com Feixes, Portão do
  Inferno com Linhas de Ação, Eclipse com Retícula). A Celestial ficou com a imagem limpa. O teste das capas altas
  ([doc 85](85-capas-altas-e-molduras-vizinhas.md)) continua sem problemas, e o site compactado também foi conferido.
