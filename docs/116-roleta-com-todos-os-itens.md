# 116 · Roleta para quem já tem todos os itens

Conferido a pedido do dono: quem já tem todos os itens da loja **não consegue pagar nem girar** a roleta
([doc 115](115-roleta-da-loja.md)).

## Como está

- **Na tela:** com todos os itens, a aba Roleta mostra só "🏆 Você já tem todos os itens da loja!", sem os botões de
  girar (nem o grátis) e sem os de comprar giros.
- **No servidor**, que vale mesmo se alguém tentar por fora da tela (uma aba antiga aberta, por exemplo):
  - comprar giros é recusado (409) quando os itens que faltam não bastam para os giros guardados mais os novos;
  - girar (grátis ou pago) é recusado (409) quando faltam menos itens do que os giros pedidos.
- **Faltando poucos itens**, a loja só vende até o número que falta: faltando 2, dá para comprar até 2 giros, e os
  botões de 3 giros ficam desligados.

## O que mudou

A mensagem de quem tem tudo e tenta comprar giros dizia "Seus giros guardados já dão para todos os itens que faltam",
que não faz sentido para quem não tem giros nem itens faltando. Agora diz **"Você já tem todos os itens da loja!"**.

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | A mensagem da compra de giros quando não falta nenhum item |

## Como foi testado

Com uma conta que tem os 49 itens: comprar 1 giro e usar o giro grátis foram recusados (409, "Você já tem todos os
itens da loja!"). Faltando 2 itens, comprar 3 giros foi recusado com "Faltam só 2 itens para você: dá para comprar
até 2 giros". Os testes passam.
