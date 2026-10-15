# 04 · API

Todas as rotas respondem JSON. As duas versões do servidor (Java e JavaScript) têm as mesmas rotas. Todas
trabalham só com os mangás e as capas da conta de quem está usando. Veja [Contas de usuário](23-contas.md).

- **Login:** quando há senha configurada, as rotas em `/api/` pedem o cookie de login, obtido em
  `POST /api/sessao`. As exceções são `/api/sessao` e `/healthz`. Veja [Tela de login de 30 dias](20-tela-de-login.md).
- **Erros:** `{"mensagem": "..."}` com status `400` (dados inválidos), `401` (sem login ou login errado), `403`
  (requisição vinda de outro site), `404` (não encontrado), `429` (muitas tentativas de login erradas) ou `500`.

## Login

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/inicio` | A sessão e as listas fixas (status, formatos, dias, ordens) em uma chamada; não pede login |
| `GET` | `/api/sessao` | `{exigeLogin, logado, conta: {id, email, nick, admin}, expiraEm}` |
| `POST` | `/api/sessao` | Entra com `{"email": "...", "senha": "..."}` e grava o cookie de 30 dias |
| `DELETE` | `/api/sessao` | Sai: apaga o cookie deste navegador |
| `POST` | `/api/contas` | Cria a conta `{email, nick, senha}` e já entra nela |
| `GET` | `/api/conta` | Dados da conta, quantos mangás ela tem e quantos mangás antigos pode trazer |
| `PUT` | `/api/conta` | Edita `{nick, email, senhaNova, senhaAtual}` (e-mail e senha pedem `senhaAtual`) |
| `DELETE` | `/api/conta` | Exclui a conta, os mangás e as capas, com `{senha}` |
| `POST` | `/api/conta/mangas-antigos` | Traz os mangás de antes das contas, com `{senha}` (a senha antiga do site) |

## Mangás

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/mangas` | Lista os mangás |
| `POST` | `/api/mangas` | Cadastra |
| `GET` | `/api/mangas/{id}` | Um mangá |
| `PUT` | `/api/mangas/{id}` | Edição geral (substitui todos os campos do formulário) |
| `PATCH` | `/api/mangas/{id}/progresso` | Altera só o último capítulo e/ou o status |
| `PUT` | `/api/mangas/{id}/nota` | Dá, troca ou tira a nota: `{"rating": 8}` ou `{"rating": null}` |
| `PUT` | `/api/mangas/{id}/favorito` | Marca ou desmarca como favorito: `{"favorite": true}` ou `{"favorite": false}` |
| `DELETE` | `/api/mangas/{id}` | Exclui o mangá e a capa enviada, se nenhum outro a usa |

### Listar: `GET /api/mangas`

| Parâmetro | Efeito |
|-----------|--------|
| `titulo` | Parte do nome, sem diferenciar maiúsculas nem acentos |
| `status` | Um dos status |
| `tag` | Nome exato de uma tag |
| `ordem` | `CADASTRO` (padrão), `RECENTES`, `TITULO`, `TITULO_DESC`, `MAIS_CAPITULOS`, `MENOS_CAPITULOS`, `MELHORES_NOTAS`, `PIORES_NOTAS` (sem nota fica no fim nas duas), `FAVORITOS` |
| `resumo` | `1` deixa de fora `description`, para listas grandes. Com ele, `tamanho` vai até 2000 |
| `inteiraAte` | Se o total couber nesse número (até 2000), devolve a lista inteira com `inteira: true`; senão, a página pedida |
| `pagina` | Com ele, a resposta vira uma página; sem ele, a lista inteira |
| `tamanho` | Itens por página (padrão 24, máximo 100) |

Sem `pagina`, a resposta é uma lista. Com `pagina`:

```json
{ "itens": [ ... ], "pagina": 1, "tamanho": 24, "total": 55, "paginas": 3 }
```

Uma página além do fim devolve a última.

### Corpo do `POST` e do `PUT`

```json
{
  "title": "Solo Leveling",
  "imagePath": "nome devolvido por POST /api/imagens, ou um link http(s)",
  "tags": ["Action", "Fantasy"],
  "chapterLinkModel": "https://site.com/manga/solo-leveling/capitulo-{cap}",
  "decimalFormat": "HIFEN",
  "lastChapter": 48.5,
  "readingStatus": "LENDO",
  "releaseDay": "QUARTA",
  "rating": 8,
  "description": "Texto livre"
}
```

### Resposta de um mangá

Os campos enviados, mais `id` e os calculados:

```json
{
  "id": "…",
  "imageUrl": "/api/imagens/…png",
  "firstChapterLink": "https://site.com/manga/solo-leveling/capitulo-1",
  "lastChapterLink": "https://site.com/manga/solo-leveling/capitulo-48-5",
  "nextChapter": 49,
  "nextChapterLink": "https://site.com/manga/solo-leveling/capitulo-49",
  "nextChapterLinkExact": false,
  "altTitles": ["Na Honjaman Level Up", "나 혼자만 레벨업"]
}
```

`nextChapterLinkExact` é `true` quando o link do próximo capítulo é um endereço já encontrado no site, e não só o
modelo preenchido.

### Progresso: `PATCH /api/mangas/{id}/progresso`

`{"lastChapter": 49, "readingStatus": "LENDO"}`, podendo mandar só um dos dois. Ao avançar para o capítulo
seguinte, o servidor antes confere o link no site de leitura (ver [05](05-links-e-leitura.md)).

## Leitura e links

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/mangas/{id}/ler` | Confere o link e redireciona para o próximo capítulo |
| `POST` | `/api/mangas/{id}/verificacao-link` | Confere o link e corrige o cadastro se o endereço mudou |
| `POST` | `/api/mangas/{id}/capitulo-lido` | Registra o capítulo lido com o endereço exato da página |

`verificacao-link` responde:

```json
{
  "situacao": "DISPONIVEL",
  "linkMudou": true,
  "linkAnterior": "https://…",
  "mensagem": "O site mudou o endereço e o link foi atualizado. O capítulo 175 está disponível.",
  "manga": { … }
}
```

`situacao` é `DISPONIVEL`, `NAO_ENCONTRADO`, `LINK_QUEBRADO` ou `NAO_VERIFICADO`.

`capitulo-lido` recebe `{"lastChapter": 8, "lastChapterUrl": "https://…", "nextChapterUrl": "https://…"}`
(o último é opcional).

## Listas especiais

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/mangas/sorteio` | Um mangá ao acaso, de qualquer status. Opcional: `?status=LER` |
| `GET` | `/api/mangas/lancamentos` | Mangás com status Lendo que lançam no dia: `?dia=QUARTA` |
| `GET` | `/api/mangas/{id}/semelhantes` | Até 6 mangás da lista com tags em comum |
| `GET` | `/api/mangas/{id}/recomendacoes` | Até 6 obras parecidas que não estão na lista |
| `GET` | `/api/recomendacoes` | Busca geral de obras fora da lista |

Em `lancamentos`, o parâmetro opcional `desde` (data e hora ISO, o início do dia de quem está olhando) tira da
resposta os mangás cujo capítulo já avançou desde então.

`GET /api/recomendacoes` aceita `busca`, `tags` (separadas por vírgula; a obra precisa ter todas), `sem` (separadas por vírgula; a obra não pode ter nenhuma; uma tag que esteja também em `tags` vale como pedida), `ordem`
(`RELEVANCIA`, `POPULARIDADE`, `NOTA`, `EM_ALTA`, `RECENTES`, `TITULO`) e `pagina`. Responde:

```json
{
  "itens": [ { "titulo": "…", "capa": "https://…", "generos": ["Ação"], "tags": ["Action"],
               "link": "https://anilist.co/manga/…", "nota": 84, "ano": 2020 } ],
  "pagina": 1, "temMais": true, "ocultos": 2, "tagsIgnoradas": ["Minha Tag"]
}
```

`ocultos` é quantas obras da página foram escondidas por já estarem na lista. `tagsIgnoradas` são tags pedidas
que a fonte não tem.

## Apoio aos formulários

| Método | Rota | O que devolve |
|--------|------|---------------|
| `GET` | `/api/status` | Status possíveis (`valor`, `descricao`) |
| `GET` | `/api/formatos-decimais` | Formatos de capítulo ",5" |
| `GET` | `/api/dias-da-semana` | Dias da semana |
| `GET` | `/api/ordens-da-lista` | Formas de ordenar a lista |
| `GET` | `/api/recomendacoes/ordens` | Formas de ordenar a busca geral |
| `GET` | `/api/tags` | Lista geral de tags (`nome`, `quantidade`) |
| `GET` | `/api/sinopse?titulo=…` | Descrição em português e tags de uma obra |

`/api/sinopse` responde `{"descricao", "idioma", "fonte", "tituloEncontrado", "traduzida", "tags"}`.

## Imagens

| Método | Rota | O que faz |
|--------|------|-----------|
| `POST` | `/api/imagens` | Envia uma capa (`multipart/form-data`, campo `arquivo`). PNG, JPG, GIF ou WEBP |
| `GET` | `/api/imagens/{nome}` | Devolve a capa (ou a miniatura, `{nome}-mini.webp`) |
| `GET` | `/api/sites` | Os sites de leitura dos mangás, sem repetir (usado pela extensão) |
| `PUT` | `/api/imagens/{nome}/miniatura` | Guarda a miniatura da capa: corpo com a imagem, WebP ou JPEG, até 300 KB |

O limite é 10 MB na versão Java e 4 MB na do Vercel.

## Outros

`GET /healthz` responde `ok` sem login. A hospedagem usa essa rota para saber se o programa está no ar.
