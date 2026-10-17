# 58 · Finanças: ganho e perda do site

Uma aba nova no **Gerenciar** (só admins), feita em outubro de 2026, para acompanhar o dinheiro do site: os gastos
(Claude, Vercel, Render, Neon...), as receitas (anúncios) e as vendas da loja (veja
[Loja de bordas e mochila](57-loja-de-bordas.md)), mês a mês.

## Onde fica

`#/gerenciar/financas` abre o mês atual; `#/gerenciar/financas/AAAA-MM` abre outro mês. As abas do Gerenciar ficaram:
Painel, **Finanças**, Contas e Registro.

## O que a tela mostra

- **O mês:** setas ‹ › para o mês anterior e o seguinte, um campo para escolher qualquer mês e o botão "Mês atual".
  Não dá para passar do mês atual.
- **Três números:** receitas, gastos e o **resultado** (receitas menos gastos), com ▲ e "Lucro" em verde ou ▼ e
  "Prejuízo" em vermelho (a palavra e a seta dizem o mesmo que a cor).
- **Duas pizzas (roscas):** "De onde vem o dinheiro" (as receitas do mês, inclusive as vendas da loja) e "Para onde
  vai o dinheiro" (os gastos). As maiores fatias primeiro; a partir da sexta, o resto vira "Outros". O total fica no
  meio, e a legenda ao lado tem o nome, o valor e a porcentagem de cada fatia. Passar o mouse numa fatia (ou na linha
  da legenda) destaca as duas.
- **Ganho e perda nos últimos 12 meses:** duas colunas por mês, receitas (azul) e gastos (laranja), com legenda. O mês
  aberto fica destacado; a dica mostra receitas, gastos e o lucro ou o prejuízo; clicar num mês abre ele.
- **Receitas e gastos do mês**, cada um com o botão **+ Receita** ou **+ Gasto** e, em cada lançamento:
  - **Mudar valor:** num mensal, o valor novo vale **a partir do mês aberto**; os meses de antes continuam com o
    valor antigo (por exemplo, o Claude subiu de R$ 110 para R$ 120 em outubro). Num de uma vez só, troca o valor.
  - **Encerrar** (só mensais): o mês aberto passa a ser o último em que ele conta (parou de pagar ou de receber).
  - **Excluir:** tira de todos os meses, para corrigir um lançamento errado.
- **Vendas da loja do mês:** quando, quem comprou (com link para o perfil), a borda, o valor, a situação
  (aprovada, reembolsada ou valor errado) e o número do pagamento no Mercado Pago, para achar a venda no painel dele.
  Reembolsadas e com valor errado aparecem riscadas e não entram nas receitas.
- **Últimos 12 meses** numa tabela: receitas, gastos e resultado de cada mês (o negativo em vermelho, com o sinal).

## Cadastrar

O botão **+ Gasto** ou **+ Receita** abre uma janela com:

- **Nome**, com sugestões (Claude, Vercel, Render, Neon, Domínio, Taxas do Mercado Pago; nas receitas, Anúncio,
  Patrocínio, Doação);
- **Valor em reais**, escrito como `12,50` ou `1.234,56`;
- **Frequência:** **Todo mês** (a partir de um mês, com um último mês opcional: vazio é "continua") ou **Uma vez só**
  (o dia do pagamento, ou do dinheiro recebido, como um anúncio pago de uma vez).

Os valores são guardados em centavos de real. Para um serviço cobrado em dólar, cadastre o que veio na fatura em
reais e use "Mudar valor" quando mudar.

## De onde vêm as vendas

As vendas da loja **entram sozinhas**: são as compras aprovadas, no mês em que foram aprovadas, pelo preço (R$ 4,50),
**antes da taxa do Mercado Pago**. Para o resultado considerar a taxa, cadastre "Taxas do Mercado Pago" como gasto.
Uma venda reembolsada sai das receitas.

## O que é guardado

Uma tabela nova, `financas`: tipo (gasto ou receita), nome, valor em centavos, frequência (mensal ou única), o
primeiro mês (ou o dia, na única) e o último mês (vazio: sem data para acabar). Mudar o valor de um mensal encerra o
lançamento no mês anterior e cria outro com o valor novo, para os meses passados não mudarem.

## API

Todas só para admins.

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/gerenciamento/financas?mes=AAAA-MM` | O mês (sem `mes`, o atual): `{ mes, atual, resumo, pizzaDasReceitas, pizzaDosGastos, receitas, gastos, meses, historico }` |
| `POST` | `/api/comunidade/gerenciamento/financas` | `{ tipo, nome, valor, recorrencia, inicio, fim }` cadastra um lançamento |
| `PUT` | `/api/comunidade/gerenciamento/financas/{id}/valor` | `{ valor, aPartirDe }` muda o valor (num mensal, a partir do mês) |
| `PUT` | `/api/comunidade/gerenciamento/financas/{id}/encerrar` | `{ ultimoMes }` encerra um mensal |
| `DELETE` | `/api/comunidade/gerenciamento/financas/{id}` | Exclui o lançamento |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_financas.js` | Novo: tabela, validação, em que meses cada lançamento conta, fatias da pizza e as rotas |
| `api/_comunidade_rotas.js` | Rota `gerenciamento/financas` |
| `api/index.js` | Tabela nova na estrutura |
| `public/app.js` | Aba Finanças: números, pizzas, ganho e perda, lançamentos, janelas de cadastro e de valor, histórico de vendas |
| `public/app.css` | Cores das séries dos gráficos (claro e escuro) e o estilo da aba |
| `test-api/financas.test.mjs` | Novo: cadastro, dados ruins, meses em que cada lançamento conta e as fatias |

As cores dos gráficos vêm de uma paleta testada para daltonismo nos dois temas; no tema claro, três cores ficam com
pouco contraste sobre o branco, e por isso cada fatia tem o nome e o valor escritos na legenda.

## Como foi testado

- Os 84 testes da versão JavaScript passam (5 novos).
- Num banco local: Claude (R$ 110 desde junho, R$ 120 a partir de outubro), Vercel, Neon, Render (até agosto), um
  domínio pago uma vez em setembro, um anúncio mensal e outro de uma vez, mais as vendas de teste da loja. Setembro
  deu R$ 150 de receitas, R$ 280 de gastos e R$ 130 de prejuízo (o Render já tinha acabado, o Claude ainda a
  R$ 110); outubro somou a venda aprovada e deixou de fora a reembolsada e a de valor errado. Uma conta que não é
  admin recebeu 403.
- No navegador: cadastrar uma receita de "1.234,56" pela janela, trocar de mês pelas setas, no computador (tema
  escuro) e no celular (390 px, tema claro), sem rolagem para o lado.

> Depois, o Painel e as Finanças passaram a ser só do dono do site (os outros admins ficam com Contas e Registro):
> veja [Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md).
