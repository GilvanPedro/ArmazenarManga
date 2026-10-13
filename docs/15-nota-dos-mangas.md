# 15 · Nota dos mangás

Mudança feita em outubro de 2026: cada mangá da lista pode receber uma nota de 0 a 10.

## O que motivou

A lista guardava o que foi lido e em que ponto, mas não o que o dono achou de cada obra.

## Como funciona

- A nota é um **número inteiro de 0 a 10**. É opcional: um mangá pode ficar sem nota.
- **0 é uma nota**, não é "sem nota".
- Cada nota cai em uma faixa, que define o indicativo mostrado ao lado dela:

| Nota | Faixa | Cor do indicativo |
|------|-------|-------------------|
| 0 a 4 | Ruim | Vermelho |
| 5 a 7 | Médio | Amarelo |
| 8 e 9 | Bom | Verde |
| 10 | Muito bom | Azul, com um anel em volta |

## O que mudou na tela

O visual descrito aqui é o da primeira versão. O indicativo virou um ícone e o selo ficou maior em
[Selo da nota com ícone](18-selo-da-nota-com-icone.md).

- **Selo na capa.** A nota aparece sobre a capa, no canto inferior direito: fundo preto, número branco e, na
  esquerda, uma bolinha com a cor da faixa. Tem o mesmo formato do selo de status, que fica no canto superior
  esquerdo. Sem nota, não há selo. O selo aparece nos cartões da lista, em "Lançam hoje", nas seções de mangás
  com tags em comum e na capa da página do mangá.
- **Página do mangá.** A linha "Minha nota" tem um seletor que salva na hora, sem abrir a edição, e mostra a nota
  com o nome da faixa ("8 · Bom"). Escolher "Sem nota" tira a nota.
- **Cadastro e edição geral.** O formulário ganhou o campo "Minha nota".

Passar o mouse sobre o selo mostra "Nota 8 de 10 · Bom", e leitores de tela leem a nota e a faixa, para a
informação não depender só da cor.

## O que mudou nos dados

O mangá ganhou o campo `rating`: inteiro de 0 a 10, ou `null` quando não há nota. Mangás cadastrados antes desta
mudança ficam sem nota, e nada precisa ser convertido no arquivo JSON nem no banco. Uma nota fora da faixa que
apareça nos dados guardados é tratada como "sem nota", sem impedir a lista de abrir.

## O que mudou no servidor

- `POST /api/mangas` e `PUT /api/mangas/{id}` aceitam `rating`. Na edição geral, deixar `rating` de fora tira a nota.
- As respostas com um mangá trazem `rating`.
- Rota nova, para mudar só a nota:

```
PUT /api/mangas/{id}/nota
{"rating": 8}        dá ou troca a nota
{"rating": null}     tira a nota
```

Uma nota fora de 0 a 10 devolve 400 com "A nota precisa ser um número inteiro de 0 a 10". Um valor que não é
número inteiro (7.5, texto) devolve 400 com "Valor inválido no campo 'rating'".

A nota é preservada quando outra coisa muda: avançar capítulo, trocar status, marcar capítulo como lido,
correção de link e busca dos outros nomes da obra.

A mudança foi feita nas duas versões do servidor.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `domain/Manga.java` | Campo `rating` |
| `domain/exceptions/InvalidRatingException.java` | Novo: nota fora da faixa |
| `service/DadosManga.java` | `rating` no cadastro e na edição |
| `service/MangaService.java`, `MangaServiceInterface.java` | Validação, `definirNota` e a nota preservada nas cópias do mangá |
| `repository/MangaJson.java` | `rating` no que é guardado |
| `web/ApiServer.java`, `web/MangaResponse.java` | Rota `/nota` e `rating` na resposta; números com casas decimais deixam de ser arredondados em campos inteiros |
| `api/index.js` | O mesmo, na versão JavaScript |
| `public/app.js`, `public/app.css` | Selo, seletor na página do mangá e campo no formulário |

## Testes

- Cinco testes novos em Java (258 no total): guardar, trocar e tirar a nota; recusar valores fora da faixa; a
  nota continuar quando outras coisas mudam; o arquivo JSON; e a rota.
- A versão JavaScript foi conferida à mão contra um banco Postgres local, com os mesmos casos. As rotas dela
  continuam sem teste automático (47 testes, sem mudança).
- A tela foi conferida em um navegador: selo em cada faixa e na nota 0, posição e cores, seletor da página do
  mangá, edição geral e largura de celular.

## O que ficou de fora

- Ordenar a lista pela nota. Isso veio depois, em [Favoritos e ordem pela nota](16-favoritos-e-ordem-pela-nota.md).
- Filtrar a lista pela nota.
- Notas com casas decimais (7,5).
