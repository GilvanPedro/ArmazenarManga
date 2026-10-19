# 118 · Roleta: o prêmio no meio da mira e só o que falta na fita

Dois ajustes na roleta da loja ([doc 115](115-roleta-da-loja.md)).

## O prêmio para no meio da mira

Para dar suspense, cada fita para um pouco para o lado do centro do prêmio (até 35% da largura de uma casa). Com isso,
o item ganho ficava torto dentro da mira. Agora, depois de parar, a fita **desliza o resto (0,45 s) até o prêmio ficar
exatamente no meio da mira**, e só então ele acende na cor do tipo, como nas caixas do CS. Quem prefere menos movimento
já vê o prêmio parado no meio.

## Só o que ainda pode sair aparece na fita

As fitas (a parada, de amostra, e as que giram) mostravam qualquer item da loja, até os que a pessoa já tinha, que nunca
podem sair. Agora mostram **só os itens que ainda faltam para ela** (e os prêmios do giro). Faltando poucos, eles se
repetem para encher a fita. Com a mochila completa, a fita de amostra diz que não há mais nada para sair. O dono do site,
que tem tudo, continua vendo todos os itens na demonstração.

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `quePodemSair` no painel da roleta (a fita parada e a dos giros); em `animarRoleta`, o deslize final até o meio da mira |

## Como foi testado

No computador e no celular, com uma conta que tinha todos os itens menos 6 e 3 giros: a fita parada e as três que giraram
(120 casas) não mostraram nenhum item que a conta já tinha, só os 6 que faltavam; "Girar 3 de uma vez" parou os três
prêmios a 0 px do meio das miras. Os testes passam.
