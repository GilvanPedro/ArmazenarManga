# 81 · A receita dos banners e a pizza de receita e despesa

Ajustes feitos em outubro de 2026 nas Finanças (veja [Finanças](58-financas.md)) e no cadastro dos banners (veja
[Banners de anúncio](76-banners-de-anuncio.md)).

## Pizza de receita e despesa (Finanças)

Embaixo dos três números do mês, uma pizza com as **receitas** (azul) e as **despesas** (laranja), com a escolha:

- **Do mês:** as do mês aberto;
- **Geral:** tudo desde o começo até o mês atual (cada lançamento mensal conta em todos os meses em que valeu, cada um
  de uma vez só conta uma vez, mais todas as vendas aprovadas da loja).

No meio da pizza fica o **resultado** (o lucro ou o prejuízo), e em cima, "Lucro de R$ ... no mês" (ou "desde o
começo"), com ▲ verde ou ▼ vermelho. A legenda tem o valor e a porcentagem de cada fatia. As cores seguem quem a fatia
é (receita sempre azul, despesa sempre laranja), e não a posição. A escolha fica guardada enquanto a página está
aberta. A resposta das Finanças ganhou `geral: { receitas, gastos }`.

## No cadastro dos banners

- **Peso:** uma barra de 0 a 10 com o número ao lado (que vai até 100) e uma explicação que muda na hora: "Peso 3:
  aparece 3 vezes mais que um banner de peso 1. Com os 4 banners no ar, fica com cerca de 33% das exibições." **Peso 0**
  passou a valer: o banner não aparece, mas fica no cadastro com os números dele.
- **Botão de escolher o arquivo:** na cor de destaque do site.
- **Quanto ele rende:** o valor em reais e a cobrança, **Por mês** ou **Uma vez só**. O valor entra **sozinho nas
  Finanças** como receita, com o nome "Banner: {empresa}":
  - **por mês:** conta em todo mês, do mês em que o valor foi cadastrado até o mês do término (ou sem fim). Já aparece
    nas Finanças no começo de cada mês;
  - **uma vez só:** conta no dia do cadastro;
  - **mudar o valor** de um mensal que já vinha de meses passados vale deste mês em diante (os meses de antes ficam com
    o valor antigo);
  - **tirar o valor** ou **trocar a cobrança** encerra a receita antiga no mês passado (ou apaga, se ela começou neste
    mês). Uma receita de uma vez só de um mês que já passou fica, porque o dinheiro entrou;
  - **apagar o banner:** a receita mensal para neste mês (que ainda conta); a de uma vez só fica.
- **Acaba em:** uma data opcional. **Nesse dia o peso vira 0** e o banner sai do ar (fica "Encerrado" na lista); a
  receita por mês para no mês do término. Como o site não tem tarefas agendadas, o peso vira 0 na próxima vez que a
  lista ou o relatório dos banners é aberto (e quando os lugares do site existirem, eles também vão respeitar a data).
  Cadastrar com uma data que já passou já salva com peso 0.

Na lista dos banners, cada um mostra quanto rende ("Rende R$ 150,00 por mês") e quando acaba, e a situação: No ar,
Pausado, Peso 0 ou Encerrado.

Nas Finanças, a receita de um banner aparece com "vem do banner: mude no cadastro do banner" e sem os botões: ela só
muda pelo cadastro do banner (as rotas das Finanças recusam mudar ou apagar essa receita).

## O que é guardado

- `banners`: `valor` (centavos), `cobranca` (`mensal` ou `unica`), `termina_em` e `lancamento` (a receita nas
  Finanças).
- `financas`: `banner` (o id do banner de onde a receita vem).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | Valor, cobrança e término; a receita nas Finanças acompanhando o cadastro; o peso 0 no término |
| `api/_financas.js` | O geral (`mesesQueContaram` e `totalAte`); a receita de banner só muda pelo banner |
| `public/app.js` | A pizza de receita e despesa; o peso com a barra e a explicação; valor, cobrança e término no cadastro; a receita de banner nas Finanças |
| `public/app.css` | O botão de arquivo, o peso, o quadro do valor e a pizza |
| `test-api/banners.test.mjs` e `test-api/financas.test.mjs` | O valor, a cobrança, o término, o peso 0 e o geral |

## Como foi testado

- Os 96 testes da versão JavaScript passam.
- No navegador, num banco local com Vercel (R$ 105/mês desde julho), Claude (R$ 110/mês desde agosto) e um anúncio de
  R$ 300 em setembro: o banner da Loja do Otaku com R$ 150 por mês até dezembro e peso 3; um banner novo da Editora
  Nova com R$ 500 de uma vez só; e o Café com o término ontem, que ficou "Encerrado" e com peso 0. Nas Finanças de
  outubro, as duas receitas dos banners (sem os botões), e a pizza do mês com R$ 650 de receita, R$ 215 de despesa e
  R$ 435 de lucro; a pizza geral com R$ 950 e R$ 750 (R$ 200 de lucro). A receita da Loja do Otaku apareceu em
  dezembro e não em janeiro, e apagar a receita de um banner pelas Finanças foi recusado. O site compactado também foi
  conferido.

> Depois, o campo do término e o seletor de mês ficaram mais bonitos: veja [O término do banner e o seletor de mês](82-termino-do-banner-e-seletor-de-mes.md).
