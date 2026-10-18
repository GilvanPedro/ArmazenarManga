# 82 · O término do banner e o seletor de mês

Dois ajustes de aparência no Gerenciar, em outubro de 2026 (continuação de
[A receita dos banners e a pizza das Finanças](81-receita-dos-banners-e-pizza-das-financas.md)).

## Quando o banner acaba (cadastro do banner)

O campo "Acaba em" virou um quadro próprio, "Quando ele acaba", no mesmo estilo de "Quanto ele rende":

- duas opções: **Sem data para acabar** e **Acaba em…** (a data só aparece na segunda; ao escolhê-la, já vem daqui a
  um mês);
- atalhos contados a partir de hoje: **+1 mês**, **+3 meses**, **+6 meses**, **+1 ano** e **Fim deste mês** (31/01 + 1
  mês dá 28/02);
- um resumo que muda na hora: "Domingo, 17 de janeiro de 2027, daqui a 92 dias. Nesse dia o peso vira 0 e o banner sai
  do ar. A receita por mês conta até janeiro de 2027 (4 meses a partir deste)." Com uma data que já passou, o resumo
  fica vermelho e avisa que, ao salvar, o banner sai do ar;
- escolher "Sem data para acabar" e salvar tira o término.

## O seletor de mês (Finanças e relatórios dos banners)

As setas, o nome do mês e o campo de mês do navegador viraram uma barra arredondada: **‹ 📅 Outubro de 2026 ▾ ›**.
Clicar no nome abre um calendário de meses embaixo, com o ano (e as setas de ano) e os 12 meses: o mês aberto em
destaque, o mês atual com contorno, e os que ainda não chegaram apagados. Fecha com Esc ou clicando fora. Fora do mês
atual aparece **↺ Mês atual**. As Finanças e os relatórios dos banners usam o mesmo seletor (`navegacaoDoMes`). Na
impressão, sai só o nome do mês.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | O quadro "Quando ele acaba" em `janelaDoBanner`; o seletor novo em `navegacaoDoMes`, usado também pelas Finanças |
| `public/app.css` | O estilo dos dois |

## Como foi testado

- Os 96 testes da versão JavaScript passam.
- No navegador: banner novo começando sem data; "Acaba em…" com um mês a partir de hoje; os atalhos; uma data passada
  (resumo vermelho); voltar para "Sem data" e salvar (o cartão passou a dizer "sem data para acabar"). No seletor:
  escolher agosto, dezembro do ano anterior pelas setas de ano, fechar com Esc, voltar ao mês atual; meses futuros e o
  próximo ano desligados; no computador (escuro) e no celular (claro), sem rolagem para o lado. O site compactado
  também foi conferido.
