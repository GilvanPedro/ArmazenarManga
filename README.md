# ArmazenarManga

Site para guardar os mangás, manhwas e webtoons que estou lendo (ou parei de ler).
Os dados ficam em `~/.mangatracker/mangas.json` e as capas enviadas em `~/.mangatracker/imagens/`.

## Como rodar

Precisa do JDK 25 ou mais novo.

```bash
mvn package                       # roda os testes e gera target/mangatracker.jar
java -jar target/mangatracker.jar # abre o site em http://localhost:7070
```

Durante o desenvolvimento, `mvn compile exec:java` sobe o site sem gerar o jar.
O site fica em `src/main/resources/public` (HTML, CSS e JavaScript puros, sem etapa de build).

### Acessar de outros computadores

Por padrão o site só atende o próprio computador. Para abrir para a rede, defina uma senha:

```bash
MANGATRACKER_HOST=0.0.0.0 MANGATRACKER_SENHA='uma senha longa' java -jar target/mangatracker.jar
```

Nos outros aparelhos da mesma rede, abra `http://IP-deste-computador:7070` (o endereço aparece no terminal)
e entre com o usuário `manga` e a senha escolhida. Sem senha o programa se recusa a abrir para a rede.

Para acessar pela internet, coloque o site atrás de HTTPS (um túnel como Cloudflare Tunnel ou Tailscale Funnel,
ou um proxy reverso em um servidor). Não exponha a porta direto: sem HTTPS a senha trafega sem criptografia.

### Configuração

| Variável              | Padrão            | Para que serve                                                        |
|-----------------------|-------------------|-----------------------------------------------------------------------|
| `PORT`                | `7070`            | Porta do site                                                         |
| `MANGATRACKER_DIR`    | `~/.mangatracker` | Pasta do `mangas.json` e das imagens                                  |
| `MANGATRACKER_HOST`   | `127.0.0.1`       | `0.0.0.0` aceita conexões de outros computadores (exige senha)        |
| `MANGATRACKER_USUARIO`| `manga`           | Usuário do login                                                      |
| `MANGATRACKER_SENHA`  | (vazio)           | Senha do login. Vazio = sem login                                     |
| `MANGATRACKER_CORS`   | (vazio)           | Outros sites que podem chamar a API, separados por vírgula            |

## API

| Método   | Rota                          | O que faz                                                                 |
|----------|-------------------------------|---------------------------------------------------------------------------|
| `GET`    | `/api/mangas`                 | Lista os mangás. Filtros opcionais: `?titulo=solo` e `?status=LENDO`      |
| `POST`   | `/api/mangas`                 | Cadastra um mangá                                                         |
| `GET`    | `/api/mangas/{id}`            | Página de informações de um mangá                                         |
| `PUT`    | `/api/mangas/{id}`            | Edição geral (todas as informações)                                       |
| `PATCH`  | `/api/mangas/{id}/progresso`  | Altera só o último capítulo lido e/ou o status                            |
| `DELETE` | `/api/mangas/{id}`            | Exclui o mangá (e a capa enviada)                                         |
| `GET`    | `/api/mangas/{id}/ler`        | Redireciona para o próximo capítulo ainda não lido                        |
| `GET`    | `/api/mangas/sorteio`         | Sorteia um mangá. Filtro opcional: `?status=LER`                          |
| `POST`   | `/api/imagens`                | Envia uma capa (`multipart/form-data`, campo `arquivo`, até 10 MB)        |
| `GET`    | `/api/imagens/{nome}`         | Devolve a capa enviada                                                    |
| `GET`    | `/api/status`                 | Status possíveis (`valor` e `descricao`)                                  |
| `GET`    | `/api/formatos-decimais`      | Formatos de capítulo ".5" no link (`HIFEN`, `PONTO`, `UNDERLINE`)         |

Corpo do `POST` e do `PUT` de mangás:

```json
{
  "title": "Solo Leveling",
  "imagePath": "nome devolvido por POST /api/imagens, ou uma URL http(s)",
  "tags": ["Ação"],
  "chapterLinkModel": "https://site-a.com/manga/solo-leveling/capitulo-{cap}",
  "decimalFormat": "HIFEN",
  "lastChapter": 48.5,
  "readingStatus": "LENDO",
  "description": "Texto livre"
}
```

`tags`, `decimalFormat` (padrão `HIFEN`) e `description` são opcionais. A resposta traz os mesmos campos mais
`id`, `imageUrl`, `lastChapterLink`, `nextChapter` e `nextChapterLink`.

Corpo do `PATCH .../progresso`: `{"lastChapter": 49, "readingStatus": "LENDO"}` (pode mandar só um dos dois).

Erros voltam como `{"mensagem": "..."}` com status `400` (dados inválidos) ou `404` (não encontrado).
