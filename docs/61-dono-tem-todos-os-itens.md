# 61 · O dono do site tem todos os itens da loja

Ajuste na loja (veja [Loja de bordas e mochila](57-loja-de-bordas.md)), feito em outubro de 2026: a conta do **dono
do site** (a mesma que vê o Painel e as Finanças, veja
[Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md)) tem **todas as bordas e todos os
efeitos**, sem comprar.

- Vale para os itens de hoje e para **os que entrarem na loja depois**: a mochila do dono é montada a partir da lista
  da loja (`ITENS_DA_LOJA`) toda vez que é aberta, e nada é gravado na tabela `mochila`.
- Na loja, todos os itens aparecem para o dono com "Na mochila" e o botão Equipar; na mochila, todos aparecem para
  equipar, com a nota "Como dono do site, você tem todos os itens da loja, inclusive os que entrarem depois".
- O dono não consegue começar uma compra (`POST /api/loja/comprar` responde 409), então nenhum pagamento é criado no
  Mercado Pago por engano. Equipar funciona sem conferir a mochila.
- As outras contas, inclusive os outros admins, continuam precisando comprar.
- `GET /api/loja` passou a trazer `temTudo` (verdadeiro só para o dono).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | O dono tem a mochila completa, equipa sem conferir e não compra |
| `api/index.js` | A loja recebe `ehDono` |
| `public/app.js` | A nota na mochila do dono |

## Como foi testado

Num banco local, com uma conta de teste no lugar do dono (`MANGATRACKER_DONO_EMAIL`): a mochila veio com os 17 itens,
comprar respondeu 409, e equipar a Arcano e a Aura funcionou sem nenhuma compra. Outra conta continuou com só os
itens comprados e recebeu 403 ao tentar equipar um que não tem. Os 85 testes da versão JavaScript passam.
