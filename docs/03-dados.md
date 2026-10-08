# 03 · Dados

## O que é guardado de cada mangá

| Campo | O que é |
|-------|---------|
| `id` | Identificador único (UUID), gerado no cadastro |
| `title` | Título, como o dono cadastrou |
| `imagePath` | Capa: nome do arquivo enviado ou um link `http(s)` |
| `tags` | Lista de tags, em texto |
| `chapterLinkModel` | Modelo do link de leitura, com `{cap}` no lugar do número do capítulo |
| `decimalFormat` | Como o site escreve capítulos ",5": `HIFEN` (48-5), `PONTO` (48.5) ou `UNDERLINE` (48_5) |
| `lastChapter` | Último capítulo lido (aceita decimais; 0 = não começou) |
| `readingStatus` | `LENDO`, `DROPADO`, `CANCELADO`, `CONCLUIDO`, `HIATUS` ou `LER` |
| `releaseDay` | Dia da semana em que lança capítulo (`SEGUNDA` a `DOMINGO`); só existe com status `LENDO` |
| `description` | Descrição livre |
| `lastChapterUrl` | Endereço exato do último capítulo lido, quando o modelo não serve para ele |
| `nextChapterUrl` | Endereço exato do próximo capítulo, quando já foi encontrado no site |
| `altTitles` | Outros nomes da mesma obra, buscados na internet (ver abaixo) |
| `lastChapterAt` | Data e hora em que o capítulo avançou pela última vez |

Os quatro últimos campos são preenchidos pelo próprio sistema e não aparecem no formulário.

### Campos calculados

A resposta da API traz também valores que não são guardados, sempre montados a partir dos campos acima:
`imageUrl`, `firstChapterLink`, `lastChapterLink`, `nextChapter`, `nextChapterLink` e `nextChapterLinkExact`.
Assim, mudar o último capítulo lido muda os links na mesma hora, sem nada para atualizar.

### Regras

- Título, capa, link, último capítulo e status são obrigatórios. Tags, descrição e dia de lançamento são opcionais.
- O capítulo não pode ser negativo.
- O link precisa ser `http(s)` e conter `{cap}`.
- O dia de lançamento só é aceito com status `LENDO` e é apagado quando o status muda para outro.
- A capa precisa ser um link `http(s)` ou uma imagem enviada antes.

### Tags

As tags são texto livre, mas existe uma **lista geral**: todas as tags em uso, mais 26 sugeridas em inglês (Action,
Fantasy, Isekai, Murim e outras). Ao salvar, uma tag que já existe na lista geral entra com o nome de lá, então
"action" e "ACTION" viram "Action". Só um nome realmente novo cria uma tag nova.

### Outros nomes da obra (`altTitles`)

Para não recomendar uma obra que já está na lista com outro nome, o sistema descobre e guarda os nomes pelos
quais cada mangá é conhecido: o original, em outras línguas e apelidos. Entre eles pode haver uma marca interna
`anilist:123`, que identifica a obra no AniList e não é mostrada como nome.

- `null` (campo ausente) significa "ainda não foi buscado".
- Lista vazia significa "buscado e nada encontrado".
- Trocar o título do mangá apaga a lista, e ela é buscada de novo.

O processo está descrito em [06 · Recomendações](06-recomendacoes.md).

## Onde fica guardado

### Arquivo JSON (uso local)

Sem banco configurado, tudo fica em `~/.mangatracker/`:

- `mangas.json`: a lista de mangás, legível e indentada.
- `imagens/`: as capas enviadas.

A gravação é feita em um arquivo temporário que depois substitui o original, para não corromper a lista se o
programa for interrompido no meio. Se o arquivo não puder ser lido, o programa não abre com a lista vazia: ele
avisa do erro, porque abrir vazio levaria a sobrescrever tudo no próximo salvamento.

### Postgres (hospedagem)

Com `DATABASE_URL` definida, os mesmos dados vão para duas tabelas, criadas sozinhas no primeiro acesso:

```sql
CREATE TABLE mangas (
    id UUID PRIMARY KEY,
    ordem BIGSERIAL,          -- mantém a ordem de cadastro
    dados JSONB NOT NULL      -- o mesmo JSON de um item do mangas.json
);

CREATE TABLE imagens (
    nome TEXT PRIMARY KEY,
    conteudo BYTEA NOT NULL   -- a capa enviada
);
```

Cada mangá continua sendo o mesmo documento JSON, só que em uma linha da tabela. Isso mantém a ideia original
de salvar em JSON e permite acrescentar campos sem alterar a tabela.

### Do arquivo para o banco

Na primeira vez que a versão Java abre com um banco **vazio** e existe um `mangas.json` local, o conteúdo é
copiado para o banco, com as capas. Os arquivos locais não são apagados, e a cópia nunca acontece se o banco já
tiver algum mangá.

## Ferramenta de manutenção

`ferramentas/salvar-e-limpar-tags.mjs` salva na pasta Downloads uma lista com o nome e as tags de cada mangá
(um `.txt` para ler e um `.json` para restaurar) e, com a opção `--apagar`, remove as tags de todos. Serve para
recomeçar as tags do zero. Sem a opção, só salva.
