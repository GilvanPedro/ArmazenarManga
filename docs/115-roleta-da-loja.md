# 115 · Roleta da loja

Uma nova aba na loja, **Roleta**, no estilo de abrir uma caixa do CS: os itens correm de um lado para o outro e
param no sorteado. É um incentivo para quem cria a conta: **o primeiro giro é de graça**. Os próximos custam
**R$ 5,00 cada**, e dá para girar **até 3 ao mesmo tempo**, com as três fitas uma em cima da outra, como linhas de
caderno, cada uma com o seu sorteio.

## As regras

- **Cada giro dá um item da loja que a pessoa ainda não tem**: uma borda, um efeito ou um tema. Nunca sai repetido,
  nem dentro de um giro triplo, e nunca sai "nada".
- **As chances**: o dono pediu 50% borda, 30% efeito e 10% tema. Como isso soma 90%, a proporção foi mantida
  (5 : 3 : 1): **borda 55,6%, efeito 33,3%, tema 11,1%**. Dentro do tipo, qualquer item que falta tem a mesma chance.
  Quando a pessoa já tem todos os itens de um tipo, ele sai da conta e as chances dos outros se dividem de novo. As
  chances aparecem na aba, sempre atualizadas.
- **O giro grátis**: um por conta, inclusive as que já existiam antes da roleta. Sem conta, a roleta aparece, e girar
  leva para criar a conta ("o primeiro giro é de graça!").
- **Os giros pagos**: comprados de 1 a 3 por vez (R$ 5,00, R$ 10,00 ou R$ 15,00), pelo mesmo Mercado Pago dos itens
  (Pix ou cartão). Eles ficam guardados na conta até a pessoa girar, e dá para girar 1, 2 ou 3 de uma vez. A loja não
  vende mais giros do que itens que faltam para a pessoa.
- **Reembolso ou estorno** de uma compra de giros: os giros que sobraram somem, e os itens que saíram deles saem da
  mochila (e das capas, se estavam equipados), como na compra de um item.
- **O dono do site** já tem tudo: os giros dele são só para ver a roleta (de graça, sem guardar nada), e ele não compra
  giros.

## Como fica

- Nas outras abas da loja, um **convite** com 🎁 enquanto o giro grátis não foi usado.
- Na aba Roleta: o título, as chances (cada tipo com a sua cor, como a raridade das caixas: **borda azul, efeito roxo,
  tema dourado**), quantos itens faltam, e o **palco**: uma folha de caderno (as pautas e a margem vermelha) com uma
  fita parada de amostra.
- Os botões: **🎁 Girar de graça** (pulsando) enquanto houver o giro grátis; depois, "Você tem N giros" com **Girar**,
  **Girar 2 de uma vez** e **Girar 3 de uma vez**, e **Comprar giros** (1, 2 ou 3).
- Girando: uma fita por giro, todas correndo juntas, rápidas no começo e cada vez mais devagar, e parando uma depois
  da outra (5,2 s, 5,9 s e 6,6 s). Cada linha tem a sua mira com setas; a casa que passa pela mira acende, e a sorteada
  brilha na cor do tipo.
- O resultado: **"Você ganhou:"**, com um cartão por item (a prévia animada, o tipo, o nome), **Equipar** e
  **👁 Pré-visualizar** (a janela da [doc 110](110-pre-visualizar-itens-da-loja.md)), e confete.
- Voltando do pagamento de giros, o aviso diz que os giros estão esperando e leva à roleta (**🎰 Girar agora**).
- Quem prefere menos movimento vê as fitas já paradas e o resultado, sem o confete.

## Como funciona

- O sorteio é feito no **servidor** (`POST /api/loja/roleta`), nunca no navegador: o navegador só recebe os itens
  sorteados e anima o caminho até eles.
- Tudo numa transação: a conta fica travada enquanto gira (dois cliques ao mesmo tempo não gastam o mesmo giro), o
  giro é gasto e os itens entram na mochila juntos. Cada item ganho fica marcado com a compra de onde saiu o giro (o
  grátis, sem compra), para o reembolso saber o que tirar.
- Banco: `contas.giro_gratis_usado` e `compras.giros_restantes` (criados sozinhos ao subir o site). A compra de giros
  é uma compra comum com o item `giros-1`, `giros-2` ou `giros-3`, e entra nas Finanças como "Roleta: N giros".
- Na fita, as prévias ficam paradas (sem as animações das bordas e efeitos), porque são dezenas de casas andando.

## Cuidado: a lei das caixas de recompensa

A Lei 15.211/2025 (o **ECA Digital**) proíbe "caixas de recompensa" (loot boxes) em jogos eletrônicos voltados a
crianças e adolescentes ou de acesso provável por eles, valendo a partir de março de 2026. O Viracap não é um jogo, mas
uma roleta paga com item aleatório, num site com público jovem, pode ser vista assim. O que ajuda a deixar a roleta
mais longe disso: cada giro sempre dá um item novo, que vale pelo menos o preço do giro (uma borda custa R$ 4,50 e um
tema até R$ 7,50, contra R$ 5,00 do giro, e todo item também está à venda direto); as chances estão à mostra. Vale
conferir com um advogado e, se for o caso, deixar os giros pagos só para maiores de 18 anos.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Preço, pesos e `sortearDaRoleta`/`chancesDaRoleta`/`girosDaCompra`; as colunas novas; a compra de giros; o giro (`girar`); o pagamento e o reembolso de giros; a roleta na vitrine |
| `api/_financas.js` | O nome "Roleta: N giros" no histórico das vendas |
| `public/app.js` | A aba Roleta, o convite, `painelDaRoleta`, `casaDaRoleta`, `animarRoleta`, a compra de giros e a volta do pagamento |
| `public/app.css` | O palco de caderno, as fitas, as cores dos tipos, as miras, os botões, os prêmios, o convite e o celular |
| `test-api/loja.test.mjs` | As chances, o sorteio pelos pesos (9.000 giros) e os giros de cada compra |

## Como foi testado

No navegador, com uma conta sem itens, no computador e no celular: o convite apareceu nas bordas; o giro grátis girou
e deu um item (gravado na mochila, e o grátis marcado como usado); um segundo giro grátis foi recusado (409) e girar
sem giros também (402); com uma compra de 3 giros aprovada, "Girar 3 de uma vez" fez as três fitas correrem e pararem
cada uma no seu prêmio (os três diferentes), os 3 giros foram gastos e os itens entraram na mochila; **Equipar** num
prêmio equipou e manteve os prêmios na tela. O dono girou 3 de demonstração sem nada ser guardado e não conseguiu
comprar giros. Os testes passam.

> Quem já tem todos os itens não paga nem gira: veja [Roleta para quem já tem todos os itens](116-roleta-com-todos-os-itens.md).

> A aba e o título passaram a ser só "Roleta", sem o emoji: veja ["Roleta" sem emoji](117-roleta-sem-emoji.md).
