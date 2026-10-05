# ArmazenarManga

Site para guardar os mangás, manhwas e webtoons que estou lendo (ou parei de ler).
Os dados ficam em `~/.mangatracker/mangas.json` e as capas enviadas em `~/.mangatracker/imagens/`.
Na hospedagem, onde não há disco permanente, os mesmos dados ficam em um banco Postgres.

## Como rodar

Precisa do JDK 25 ou mais novo.

```bash
mvn package                       # roda os testes e gera target/mangatracker.jar
java -jar target/mangatracker.jar # abre o site em http://localhost:7070
```

O `./iniciar.sh` faz o mesmo em um comando: escolhe o JDK certo, gera o jar se faltar e carrega o arquivo `.env`.
Durante o desenvolvimento, `mvn compile exec:java` sobe o site sem gerar o jar.

### Usar o banco de dados (Neon)

Copie `.env.exemplo` para `.env`, cole a *connection string* do Neon em `DATABASE_URL` e rode `./iniciar.sh`.
Na primeira vez, se o banco estiver vazio, o que já estava em `~/.mangatracker` é copiado para ele.
O `.env` tem a senha do banco e não vai para o GitHub.
O site fica em `src/main/resources/public` (HTML, CSS e JavaScript puros, sem etapa de build).

### Acessar de outros computadores

Por padrão o site só atende o próprio computador. Para abrir para a rede, defina uma senha:

```bash
MANGATRACKER_HOST=0.0.0.0 MANGATRACKER_SENHA='uma senha longa' java -jar target/mangatracker.jar
```

Nos outros aparelhos da mesma rede, abra `http://IP-deste-computador:7070` (o endereço aparece no terminal)
e entre com o usuário `manga` e a senha escolhida (mínimo de 12 caracteres). Sem senha o programa se recusa a abrir para a rede.

### Hospedar na internet de graça (Vercel + Neon)

O Vercel não roda Java, então lá o site usa uma segunda versão da API, em JavaScript (`api/index.js`), com as
mesmas rotas e regras do backend Java e o mesmo banco. As páginas (`src/main/resources/public`) são as mesmas.
Quem muda uma regra no Java precisa mudar também no `api/index.js`.

1. Importe o repositório no Vercel (o `vercel.json` já tem a configuração).
2. Em *Settings > Environment Variables*, defina:
   - `DATABASE_URL`: a connection string do Neon (a integração Neon do Vercel cria essa variável sozinha);
   - `MANGATRACKER_SENHA`: a senha do site (mínimo de 12 caracteres).
3. Faça um novo deploy (*Deployments > Redeploy*) para as variáveis valerem.

O login é o usuário `manga` com a senha escolhida. No Vercel as capas enviadas podem ter até 4 MB (limite da
plataforma); capas por link não têm limite.

### Alternativa: Render + Neon (roda o backend Java)

Hospedagens gratuitas não têm disco permanente, então na internet os mangás e as capas ficam em um banco
Postgres em vez de arquivos. Basta definir `DATABASE_URL`; o resto do programa é o mesmo.

1. **Banco:** crie uma conta em https://neon.tech, crie um projeto na região *AWS US East (N. Virginia)* e copie a
   *connection string* (`postgresql://usuario:senha@servidor/banco?sslmode=require`).
2. **Site:** em https://render.com, escolha *New > Blueprint* e selecione este repositório. O `render.yaml` já tem
   a configuração; o Render só pede dois valores:
   - `DATABASE_URL`: a connection string do Neon;
   - `MANGATRACKER_SENHA`: a senha do site (mínimo de 12 caracteres).

O site fica em `https://meus-mangas.onrender.com` (ou parecido), com usuário `manga`. A cada `git push` na `main`
o Render publica de novo. No plano gratuito o site dorme depois de 15 minutos sem uso e leva cerca de um minuto
para acordar no próximo acesso.

### Configuração

| Variável              | Padrão            | Para que serve                                                        |
|-----------------------|-------------------|-----------------------------------------------------------------------|
| `PORT`                | `7070`            | Porta do site                                                         |
| `MANGATRACKER_DIR`    | `~/.mangatracker` | Pasta do `mangas.json` e das imagens                                  |
| `DATABASE_URL`        | (vazio)           | Endereço de um Postgres. Se definido, os dados vão para o banco em vez da pasta |
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
| `GET`    | `/api/mangas/{id}/ler`        | Confere o link no site e redireciona para o próximo capítulo ainda não lido |
| `POST`   | `/api/mangas/{id}/capitulo-lido` | Registra o capítulo lido com o endereço exato da página dele (e do próximo, se conhecido) |
| `POST`   | `/api/mangas/{id}/verificacao-link` | Confere no site o link do próximo capítulo e corrige se o endereço mudou |
| `GET`    | `/api/mangas/lancamentos`     | Mangás com status Lendo que lançam capítulo no dia: `?dia=QUARTA`         |
| `GET`    | `/api/mangas/sorteio`         | Sorteia um mangá (concluídos e cancelados ficam de fora). Filtro opcional: `?status=LER` |
| `POST`   | `/api/imagens`                | Envia uma capa (`multipart/form-data`, campo `arquivo`, até 10 MB)        |
| `GET`    | `/api/imagens/{nome}`         | Devolve a capa enviada                                                    |
| `GET`    | `/api/status`                 | Status possíveis (`valor` e `descricao`)                                  |
| `GET`    | `/api/sinopse`                | Descrição do mangá buscada na internet pelo título: `?titulo=Solo Leveling` |
| `GET`    | `/api/dias-da-semana`         | Dias da semana possíveis (`valor` e `descricao`)                          |
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
  "releaseDay": "QUARTA",
  "description": "Texto livre"
}
```

`tags`, `decimalFormat` (padrão `HIFEN`), `releaseDay` e `description` são opcionais. `releaseDay` (dia em que
o mangá lança capítulo) só é aceito com status `LENDO` e é apagado quando o status muda para outro. A resposta traz os mesmos campos mais
`id`, `imageUrl`, `firstChapterLink`, `lastChapterLink`, `nextChapter` e `nextChapterLink`.

Corpo do `PATCH .../progresso`: `{"lastChapter": 49, "readingStatus": "LENDO"}` (pode mandar só um dos dois).

### Verificação de link

Alguns sites trocam o id do endereço (da obra ou de cada capítulo), e o modelo com `{cap}` deixa de funcionar.
A verificação abre a página do último capítulo lido, procura nela o link do próximo capítulo e confirma que ele abre.
Se o endereço mudou, o cadastro é corrigido: o modelo é atualizado quando o id novo vale para todos os capítulos,
ou o endereço exato do próximo capítulo é guardado quando cada capítulo tem um id próprio. Não há código específico
para nenhum site; funciona com qualquer um que entregue os links no HTML ou redirecione o endereço antigo.

A resposta traz `situacao` (`DISPONIVEL`, `NAO_ENCONTRADO`, `LINK_QUEBRADO` ou `NAO_VERIFICADO`), `linkMudou`,
`linkAnterior`, `mensagem` e o `manga` já corrigido. `NAO_VERIFICADO` acontece quando o site não responde ou bloqueia
acessos automáticos; nesse caso nada é alterado. Só sites públicos são consultados: endereços da rede interna do
servidor são recusados.

Ela roda sozinha em dois momentos: ao clicar em **Ler** (antes de abrir o capítulo) e ao **avançar o último capítulo
lido** para o seguinte (para já salvar o link com o id novo). Também há o botão **Verificar link** na página do mangá.
A versão do Vercel faz o mesmo em `api/_verificador.js`, com testes em `test-api/` (`npm test`).

### Sites que bloqueiam o servidor

Sites com proteção contra robôs (o desafio do Cloudflare, por exemplo) só entregam as páginas a um navegador de
verdade, então a verificação acima responde `NAO_VERIFICADO` neles. Para esses sites o endereço é capturado no
navegador de quem está lendo:

- **Extensão de navegador** (pasta `extensao/`, para Chrome, Edge, Brave e Firefox): com ela instalada e liberada
  para o site, o botão Ler resolve tudo sozinho. O servidor tenta primeiro; se for barrado, a extensão abre o último
  capítulo lido em uma aba, espera a proteção do site passar, acha o link do próximo capítulo, leva a aba até ele e
  o site salva os endereços exatos. A instalação está explicada na aba **Extensão e atalho** do site. A extensão só
  atende ao site que o dono liberar pelo ícone dela.
  Ela também marca capítulos como lidos sem favorito: um botão "✓ Lido" aparece no canto das páginas dos sites onde
  há mangá cadastrado, e o mesmo pode ser feito pelo ícone da extensão ou com Alt+Shift+L.
- **Atalho do navegador** (na mesma aba): um favorito que, clicado na página do capítulo, abre o site
  com o mangá, o capítulo e o link do próximo capítulo já preenchidos para confirmar.
- **Campo "Link do capítulo lido"** ao alterar o capítulo: basta colar o endereço da página.

Marcar como lido também atualiza o modelo do link com o id que estiver no endereço do capítulo. Se o mangá ainda
não está na lista, abre o cadastro já preenchido com o que a página informa (nome, capítulo, link e capa) e com a
descrição buscada por `GET /api/sinopse`: em português do MangaDex quando existe, senão em inglês do AniList
traduzida automaticamente pelo MyMemory. O campo de descrição do cadastro tem um botão para repetir essa busca.

Os dois chamam `POST /api/mangas/{id}/capitulo-lido` com
`{"lastChapter": 8, "lastChapterUrl": "...", "nextChapterUrl": "..."}` (`nextChapterUrl` é opcional).
Com o endereço do próximo capítulo guardado, o botão Ler abre direto nele; sem ele, abre o último capítulo lido,
que tem o botão de próximo do próprio site.

Erros voltam como `{"mensagem": "..."}` com status `400` (dados inválidos) ou `404` (não encontrado).
