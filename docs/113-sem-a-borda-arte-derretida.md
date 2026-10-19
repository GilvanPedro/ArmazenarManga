# 113 · Sem a borda Arte Derretida

A borda **Arte Derretida** saiu da loja. Ela era a mesma moldura da **Celestial** (ouro com runas azuis e a estrela
com a lua no canto), só com gotas escorrendo, e as duas pareciam o mesmo item. Fica a Celestial.

## Quem tinha

Ninguém: no banco do site no ar, nenhuma compra, nenhuma mochila e nenhuma conta com ela equipada. Por isso não foi
preciso tratar quem a tivesse (como foi feito com o tema Silhueta, no [doc 72](72-sem-tema-de-imagem.md)).
O dono do site, que tem todos os itens sem comprar ([doc 61](61-dono-tem-todos-os-itens.md)), deixa de ver a Arte
Derretida na mochila.

## O que mudou

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | A borda `derretida` saiu de `ITENS_DA_LOJA` (a loja tem agora 18 bordas) |
| `public/app.css` | O bloco da `.borda-derretida` e o nome dela nas 17 regras que valem para várias bordas |
| Banco (imagens da loja) | A imagem `arte-derretendo.png`, que só ela usava, apagada depois de o site novo estar no ar |

As outras três molduras de imagem do [doc 84](84-quatro-molduras-de-imagem.md) (Relíquia, Bosque Élfico e Portão do
Inferno) continuam iguais.

## Como foi testado

Os testes passam, o site compactado foi gerado, e a lista de bordas da loja tem 18, sem a Arte Derretida e com a
Celestial.
