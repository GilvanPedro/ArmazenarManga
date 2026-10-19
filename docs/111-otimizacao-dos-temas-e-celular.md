# 111 · Otimização dos temas animados e dos vídeos no celular

Uma revisão do site para gastar menos do computador e do celular, com atenção aos temas animados (os de CSS e os de
vídeo) e a como eles aparecem no celular. E a correção da rolagem da pré-visualização da loja.

## Como foi medido

Uma Biblioteca com 20 mangás (6 favoritos), aberta no Chrome sem tela por 5 s parada, somando o processador de todos
os processos do navegador, no computador (1400 × 860) e num celular simulado (390 × 844, tela de densidade 3). No
Chrome sem tela, o desenho é feito pelo processador (não pela placa de vídeo), então os números são mais altos que num
aparelho de verdade. Servem para comparar.

A rede já estava enxuta: poucos pedidos por página, capas leves, e a API respondendo em poucos milissegundos. O peso
estava nas animações.

## O que mudou

**O reflexo dos favoritos.** O brilho que passa pelas capas favoritas era uma animação sem fim: 2,7 s andando e 4,3 s
parada. Mesmo parada, ela fazia o navegador redesenhar a tela o tempo todo, e era o que pesava com os temas sem
animação. Agora o `app.js` dispara cada passada de 7 em 7 segundos (pondo e tirando a classe `.reflexo`), só nas capas
que estão na tela, e entre uma e outra nada é redesenhado. O efeito é igual. Não passa com a janela sem foco, a aba
escondida ou para quem prefere menos movimento, e as capas com uma borda ou efeito da loja que já anima o próprio
brilho ficam de fora.

**Aurora e Galáxia sem o desfoque.** As duas desfocavam (`filter: blur`) uma camada maior que a tela, refeito a cada
quadro. Os degradês já são macios, então o desfoque saiu (com degradês um pouco mais longos no lugar).

**Kyoto no tamanho de verdade da arte.** A pixel art é feita de blocos de 3 × 3 pixels no vídeo de 1080p: a arte tem
640 × 360. O vídeo agora vem nesse tamanho (209 KB em vez de 559 KB, e 9 vezes menos para decodificar), e o navegador
amplia sem borrar (`image-rendering: pixelated`). Fica igual.

**Os vídeos em pé no celular.** Numa tela em pé, o vídeo deitado era cortado no meio: o palácio (que fica à direita)
sumia, e o Kyoto aparecia como um zoom. Agora cada tema tem uma versão vertical, recortada no que importa da cena (o
palácio, a cerejeira com a casinha, o rosto), menor e mais leve. O site escolhe pela tela (em pé ou deitada) e troca
se o celular virar:

| Tema | Deitado (computador) | Em pé (celular) |
|------|----------------------|-----------------|
| Palácio Zen | 1280 × 720, 1,7 MB | 540 × 960, 990 KB (MP4 662 KB) |
| Primavera em Kyoto | 640 × 360, 209 KB | 204 × 360, 141 KB |
| Lâmina Sombria | 1280 × 720, 2,1 MB (era 2,3 MB) | 450 × 800, 1,5 MB (MP4 1,2 MB) |

A Lâmina também ficou um pouco mais leve (o granulado da arte foi suavizado e o vídeo é em tons de cinza).

**Economia de dados.** Com a economia de dados do celular ligada, os temas em vídeo mostram só a imagem parada.

**A rolagem da pré-visualização da loja.** A miniatura do site dentro da janela era `inert` (para os botões dela não
fazerem nada), e isso também impedia a rolagem: a roda do mouse ou o dedo rolavam a página de trás. Agora quem rola é
uma caixa por fora da miniatura; a página de trás fica parada enquanto a janela está aberta, e rolar até o fim da
janela não passa para a página.

## Resultado

Processador gasto com a página parada (no Chrome sem tela, mais alto que num aparelho de verdade):

| | Antes (computador / celular) | Depois (computador / celular) |
|---|---|---|
| Temas sem animação (escuro, claro…) | 21% / 10% | 8% / 3% |
| Primavera em Kyoto | 78% / 60% | 33% / 17% |
| Palácio Zen | 83% / 56% | 74% / 41% |
| Lâmina Sombria | 81% / 51% | 69% / 38% |
| Aurora | 102% / 103% | 103% / 57% |
| Galáxia | 102% / 102% | 103% / 58% |
| Os outros animados | 74 a 104% / 37 a 69% | 65 a 105% / 32 a 69% |

No computador, os temas animados de CSS continuam perto de um núcleo inteiro nesse teste, porque sem placa de vídeo o
Chrome redesenha a tela toda a cada quadro pelo processador. Num computador com placa de vídeo, quem faz esse trabalho
é ela. O que dava para tirar sem mudar a cara dos temas saiu. O resto é o custo de um fundo que se mexe na tela toda,
e ele já para com a janela sem foco ou a aba escondida (doc 100).

## Como os temas aparecem no celular

Todos os 17 temas foram abertos no celular simulado: os de cor, os animados de CSS (o fundo se mexendo atrás do
conteúdo, sem atrapalhar a leitura) e os três em vídeo, com a versão vertical tocando (o palácio, a cerejeira e o rosto
no centro). Virando o celular, o vídeo troca para o deitado.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | O reflexo dos favoritos disparado de 7 em 7 s; `fontesDoFundo` e `videoDeFundo` (o vídeo em pé ou deitado, a economia de dados, a troca ao virar); a rolagem da pré-visualização |
| `public/app.css` | O reflexo com a classe `.reflexo`; Aurora e Galáxia sem o blur; a rolagem da pré-visualização e a página de trás parada |
| Banco (imagens da loja) | `kyoto-2` e `kyoto-retrato-2`, `lamina-2` e `lamina-retrato-1`, `palacio-zen-retrato-1` (WebM e MP4) e `kyoto-2.jpg` |

## Como foi testado

- As medições acima, antes e depois.
- O reflexo: passou nas 6 capas favoritas depois de 7 s, e 3 s depois nenhuma estava mais com ele.
- A pré-visualização: a roda do mouse rolou a janela e a página de trás ficou parada (também com a roda em cima da
  barra da janela); no celular, o dedo rolou a janela até o fim e a página de trás não se mexeu.
- No celular: os três temas em vídeo tocaram a versão vertical (540 × 960, 204 × 360 e 450 × 800) e, deitando o celular,
  a horizontal.
- Aurora e Galáxia sem o blur, conferidas na tela.
- Os testes passam.

> Uma segunda rodada (os fundos a 30 quadros por segundo e os vídeos a 24): veja [Temas animados a 30 quadros por segundo e vídeos a 24](112-temas-animados-a-30-quadros.md).
