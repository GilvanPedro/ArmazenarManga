# 85 · Capas altas esticando e molduras encostando

Dois problemas nas capas dos favoritos com borda, achados em outubro de 2026.

## Imagens altas esticavam a capa

Com uma borda que deixa o enfeite sair da capa (Galáxia, Cristal, Cyberpunk, Abissal, Sombrio, Floresta, Elétrico,
Arcano, Aurora Boreal, Eclipse e as molduras de imagem), uma capa com imagem mais alta que 2:3 crescia para baixo até
o tamanho da imagem: uma imagem de 300 × 1600 deixava a capa com uns 990 px de altura em vez de 290, passando por cima
de tudo.

**Por quê:** essas bordas trocam o `overflow: hidden` da capa por `overflow: visible` (para o enfeite aparecer), e,
numa caixa com `aspect-ratio`, a altura mínima automática passa a ser a do conteúdo quando o overflow é visível.

**O conserto:** `min-height: 0` na `.capa` (e na prévia dos itens da loja): a capa fica sempre em 2:3, e a imagem é
cortada pelo `object-fit: cover` como nas outras.

## As molduras de imagem encostavam nas capas vizinhas

A Celestial e as quatro molduras novas ([doc 84](84-quatro-molduras-de-imagem.md)) passam uns 10% da capa para cada
lado, mais que o vão entre as colunas: na biblioteca, a moldura de uma capa encostava (e passava por cima) da moldura
da vizinha. Agora a capa com uma dessas molduras encolhe para 84% (com a propriedade `scale`, que convive com o
`transform` do hover), e capa + moldura ocupam exatamente o lugar de uma capa normal.

## Também: imagens dos posts

Nos posts da Comunidade com três imagens, uma imagem alta na coluna da direita pegava mais altura que a outra (265 px
contra 97). As linhas da grade agora dividem a altura por igual (`grid-auto-rows: minmax(0, 1fr)`).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `min-height: 0` na capa e na prévia da loja; as molduras de imagem a 84%; as linhas das imagens dos posts |

## Como foi testado

- Os 96 testes da versão JavaScript passam.
- Um teste no navegador cria mangás (favoritos e comuns) com capas de 300 × 1600, 200 × 3000, 1600 × 400, 800 × 800
  e 400 × 600 e mede todas as capas da biblioteca com cada uma das 19 bordas e sem borda: antes, 30 capas fora do 2:3
  (as altas, em 15 bordas); depois, nenhuma. Também conferidos a página do mangá, os mangás de um perfil e o celular.
- Medido também quanto cada moldura passa da coluna: as de imagem passavam e agora ocupam a coluna exata (no
  computador e no celular).
- Posts com 2, 3 e 4 imagens altas e largas: as imagens ficam dentro da grade, e as duas da direita no post de três
  com a mesma altura. O site compactado também foi conferido.
