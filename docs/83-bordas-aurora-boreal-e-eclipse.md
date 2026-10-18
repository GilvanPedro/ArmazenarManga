# 83 · Bordas Aurora Boreal e Eclipse

Duas bordas animadas novas na loja (R$ 4,50 cada, como as outras), feitas para chamar a atenção sem encher a capa:
as duas desenham só na moldura e no brilho por fora, e a imagem do mangá fica limpa.

## Aurora Boreal (`boreal`)

- A moldura tem as cores da aurora (verde, ciano, azul, violeta e rosa) que **correm devagar em volta da capa** (uma
  volta a cada 7 segundos).
- Por fora, um **brilho borrado com as mesmas cores** acompanha a moldura e "respira" (fica mais forte e mais fraco a
  cada 5 segundos).
- A estrela do favorito vira um ✦ com as mesmas cores girando.
- O id é `boreal` porque `aurora` já é o id de um tema (os ids não podem se repetir na loja).

## Eclipse (`eclipse`)

- Moldura escura de **obsidiana**, com um fio dourado bem fino por fora e um halo quente bem leve.
- Um **ponto de luz dourada dá a volta** na moldura (a cada 4,5 segundos), deixando um rastro que se apaga, com a
  ponta macia e um brilho em volta.
- Quando a luz passa pelo canto de cima à direita, faísca o **anel de diamante** (o brilho de um eclipse de verdade):
  uma estrela de quatro pontas que abre e fecha. Ele acontece no tempo exato em que a luz passa pelo canto (numa capa
  2:3, o canto fica a 33,7° do topo, ou 9,4% da volta).
- A estrela do favorito vira o disco do eclipse (preto, com o anel dourado).

## Como funciona

- A volta da luz vem de um ângulo animado (`--aurora` e `--eclipse`, registrados com `@property`). Navegador sem
  `@property` mostra a moldura parada, sem quebrar.
- O brilho fica na camada `.enfeite-da-borda`, que passa 26 px para fora da imagem. A máscara dela, aplicada depois do
  borrado, esconde o miolo: o brilho aparece só por fora e em cima da moldura, sem borrar a imagem, e com folga para
  não ser cortado num retângulo.
- Quem prefere menos movimento (configuração do aparelho) vê as duas paradas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os dois itens novos |
| `public/app.css` | As duas bordas (e a entrada delas na lista das bordas ornamentadas) |

## Como foi testado

- Os 96 testes da versão JavaScript passam (inclusive o de ids que não se repetem).
- No navegador, na loja e numa capa de verdade da biblioteca, no tema escuro e no claro, com quadros parados em
  momentos escolhidos da animação: a luz do Eclipse no canto junto com o anel de diamante, e no meio da volta; o
  brilho da Aurora sem passar por cima da imagem e sem cantos cortados. O site compactado também foi conferido.
