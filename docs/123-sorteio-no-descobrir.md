# 123 · Sorteio no Descobrir

A aba **Descobrir** da Biblioteca ganhou um botão **🎲 Sortear**, ao lado da ordem. Ele sorteia uma obra para ler que
ainda não está na lista, com o mesmo sorteio no estilo de abrir um baú da lista ([doc 114](114-sorteio-estilo-abrir-bau.md)):
a fita de capas corre, para na sorteada, e ela aparece grande, com a moldura dourada e o confete.

## De onde sai a obra

- Respeita o que está escolhido no Descobrir: o nome buscado, as tags de "Quero", as de "Não quero" e a ordem.
- Obras que já estão na lista não entram (a mesma regra da busca do Descobrir).
- A fonte (AniList) não diz quantas páginas a busca tem. Por isso o sorteio pega uma página ao acaso entre as 10
  primeiras (até 240 obras). Se ela vier vazia, porque a busca acha pouca coisa, usa a primeira página.
- A fita mostra as obras dessa mesma página. A última obra sorteada não sai de novo logo em seguida, quando há outra.
- Se nada for achado, aparece o aviso "Nada para sortear com essa busca".
- Funciona também sem conta, como o resto do Descobrir.

## O resultado

Em cima, "Que tal ler:". Embaixo do nome: a nota do AniList, o ano e os dois primeiros gêneros. Os botões são:

- **+ Adicionar à lista**: abre o cadastro já preenchido com o nome, a capa e as tags, como o "+ Adicionar" dos cartões;
- **Ver no AniList**: abre a página da obra em outra aba;
- **🎲 Sortear de novo**.

## Por dentro

`abrirSorteio` passou a receber o "jeito" do sorteio: a capa de cada item da fita, o selo, a linha embaixo do nome,
os botões e como sortear de novo. `SORTEIO_DA_LISTA` é o de antes, sem mudança para quem usa. `SORTEIO_DO_DESCOBRIR`
é o novo, com `sortearDescoberta` e `capaDaObra`. A nota, o ano, os gêneros e o link de adicionar viraram funções
(`detalhesDaObra`, `linkParaAdicionar`), usadas pelos cartões e pelo sorteio.

## Defeito corrigido junto

A tela do Descobrir mostrava a palavra "null" solta acima das abas, quando aberta sem as boas-vindas de quem está sem
conta (pelo endereço `#/descobrir`). Agora as partes vazias saem antes de montar a tela.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | O botão no Descobrir, o sorteio das obras, o sorteio em comum e o "null" |

> O "Sortear de novo" passou a mostrar "Sorteando…" até o próximo chegar, e o confete voltou no site no ar: veja [doc 124](124-sortear-de-novo-e-confete.md).
