# 16 · Favoritos e ordem pela nota

Mudança feita em outubro de 2026, em duas partes: marcar um mangá como **favorito**, com destaque na lista, e
**ordenar a lista pela nota** criada em [Nota dos mangás](15-nota-dos-mangas.md).

## Favoritos

### Como funciona

- Na página do mangá, o botão **☆ Favoritar** marca o mangá. Marcado, ele vira **★ Favorito**, e clicar de novo
  desmarca. Salva na hora, sem abrir a edição.
- O favorito aparece destacado em toda capa dele: **borda dourada com brilho** e uma **estrela dourada** no
  canto superior direito. Vale para a lista principal, "Lançam hoje", as seções de tags em comum e a capa da
  página do mangá.
- A estrela existe para o destaque não depender só da cor da borda. Leitores de tela leem "(favorito)" junto do
  nome.
- Não há limite de favoritos.
- O favorito não está no formulário de cadastro e edição. Um mangá novo começa sem a marca, e a edição geral
  não desmarca.

Os cantos da capa ficam assim: status em cima à esquerda, estrela de favorito em cima à direita, nota embaixo
à direita.

### No servidor

O mangá ganhou o campo `favorite` (`true` ou `false`). Mangás de antes da mudança contam como não favoritos, sem
conversão nos dados. As respostas com um mangá trazem `favorite`.

```
PUT /api/mangas/{id}/favorito
{"favorite": true}      marca
{"favorite": false}     desmarca
```

Sem `favorite`, ou com um valor que não é `true` nem `false`, a rota devolve 400.

O favorito é preservado quando outra coisa muda: capítulo, status, nota, marcar como lido, correção de link,
busca dos outros nomes e edição geral.

## Ordem pela nota e pelos favoritos

O seletor de ordem da página principal ganhou três opções:

| Opção | Valor em `?ordem=` | Como ordena |
|-------|--------------------|-------------|
| Melhores notas | `MELHORES_NOTAS` | Da maior nota para a menor |
| Piores notas | `PIORES_NOTAS` | Da menor nota para a maior |
| Favoritos primeiro | `FAVORITOS` | Favoritos em cima; o resto na ordem de cadastro |

- Mangás **sem nota ficam no fim** nas duas ordens de nota. Em "Piores notas" isso evita que o que ainda não foi
  avaliado apareça na frente do que recebeu nota baixa.
- Empate de nota fica em ordem alfabética.
- As ordens combinam com a busca, o filtro de status e a paginação, como as outras.

"Favoritos primeiro" não foi pedida; entrou porque o favorito sozinho não tinha como ser encontrado em uma
lista grande.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `domain/Manga.java` | Campo `favorite` |
| `service/MangaService.java`, `MangaServiceInterface.java` | `definirFavorito` e o favorito preservado nas cópias do mangá |
| `repository/MangaJson.java` | `favorite` no que é guardado |
| `web/ApiServer.java`, `web/MangaResponse.java` | Rota `/favorito`, `favorite` na resposta e as três ordens novas |
| `api/index.js` | O mesmo, na versão JavaScript |
| `public/app.js`, `public/app.css` | Borda e estrela na capa, botão de favoritar |

O seletor de ordem não precisou mudar: ele já lê as opções de `/api/ordens-da-lista`.

## Testes

- Dois testes novos em Java (260 no total): marcar e desmarcar sem mexer no resto, e as três ordens com a rota
  de favorito. O teste que conta as formas de ordenar passou de 6 para 9.
- A versão JavaScript foi conferida à mão contra um banco Postgres local, com os mesmos casos (47 testes
  automáticos, sem mudança).
- A tela foi conferida em um navegador: favoritar e desfavoritar, borda e estrela na lista e na página do
  mangá, e as três ordens.

## O que ficou de fora

- Favoritar direto do cartão da lista, sem abrir a página do mangá.
- Um filtro para ver só os favoritos.
- Filtrar a lista por faixa de nota.
