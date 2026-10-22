# 124 · "Sortear de novo" com resposta na hora, e o confete de volta

## O "Sortear de novo" parecia não funcionar

O botão fechava a janela do sorteio na hora e só depois ia buscar o próximo sorteado. No Descobrir essa busca passa
pelo AniList e pode levar alguns segundos. Nesse tempo a tela ficava parada, sem nada, e parecia que o botão não
tinha feito nada (ou a pessoa clicava de novo).

Agora:

- o botão clicado vira **"Sorteando…"** e fica travado enquanto o próximo é buscado;
- a janela só é trocada quando o próximo sorteado chega;
- se a busca der erro, a janela continua aberta, o botão volta ao normal e aparece o aviso;
- o mesmo vale para o botão **🎲 Sortear** da lista e do Descobrir.
- No Descobrir, as páginas já buscadas ficam guardadas por 10 minutos, separadas pela busca, pelas tags e pela ordem.
  Sortear de novo numa delas sai na hora, sem esperar o AniList.

Por dentro: `sortearCom(jeito, botao, antesDeAbrir)` faz isso para os dois sorteios. Cada "jeito"
(`SORTEIO_DA_LISTA`, `SORTEIO_DO_DESCOBRIR`) tem `buscar`, que devolve `{item, outros}` ou `null` depois de avisar o
erro: `buscarDaLista` e `buscarDescoberta` ([doc 123](123-sorteio-no-descobrir.md)).

## O confete não aparecia no site no ar

Cada pedaço do confete recebe a posição e a cor pelo atributo `style`. A política de segurança do site
(Content-Security-Policy, [doc 122](122-tag-do-google.md)) não deixa a página escrever o atributo `style` direto, então
o navegador barrava os 70 pedaços e o confete não aparecia. Localmente ele aparecia, porque o servidor de teste não
mandava a política.

A função `h()`, que cria os elementos, passou a pôr o estilo pelo `element.style` (CSSOM), que a política permite. Isso
corrigiu também as amostras de cor da legenda do gráfico de finanças, que usavam o mesmo atributo.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `sortearCom`, a busca separada de cada sorteio, as páginas guardadas do Descobrir e o estilo pelo CSSOM em `h()` |

> No Firefox, o "Sortear de novo" fugia do clique por causa de uma barra de rolagem; corrigido no [doc 135](135-sortear-de-novo-no-firefox.md).
