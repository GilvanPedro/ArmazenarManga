# 02 · Arquitetura

## Visão de cima

```
Navegador ── site (HTML, CSS e JS puros) ── API HTTP ── armazenamento
                                              │
                                              ├── versão Java  (Javalin)      → arquivo JSON ou Postgres
                                              └── versão JavaScript (Vercel)  → Postgres
```

O site é o mesmo nos dois casos. O que muda é quem responde às chamadas de `/api/...`.

## Por que existem duas versões do servidor

O projeto nasceu em Java. Ao publicar, a hospedagem escolhida (Vercel) não roda programas Java, então a API
foi reescrita em JavaScript como uma função do Vercel. As duas versões:

- têm as **mesmas rotas, regras e mensagens**;
- usam o **mesmo banco e as mesmas tabelas**, então uma lê o que a outra grava;
- precisam ser alteradas **juntas**. Cada arquivo JavaScript diz no topo qual classe Java ele espelha.

| | Versão Java | Versão JavaScript |
|---|---|---|
| Onde roda | Computador local, Render (Docker) | Vercel |
| Código | `src/main/java/...` | `api/` |
| Armazenamento | Arquivo JSON ou Postgres | Só Postgres |
| Limite de capa enviada | 10 MB | 4 MB (limite da plataforma) |
| Testes | 253, em todas as camadas do servidor | 47, cobrindo verificação, sinopse e recomendações |

## Versão Java: camadas

O código segue a arquitetura em camadas do planejamento original. Cada camada só conhece a de baixo.

```
br.com.seuapp.mangatracker
├── App.java            lê a configuração, monta as peças e sobe o servidor
├── domain/             regras que valem sempre
│   ├── Manga, Tag, ReadingStatus, WeekDay, ChapterDecimalFormat
│   ├── ChapterLink     modelo do link → endereço do capítulo
│   └── exceptions/     um tipo de erro para cada regra violada
├── service/            casos de uso
│   ├── MangaService            cadastro, edição, progresso, busca, tags, sorteio, lançamentos
│   ├── ImagemService           recebe e valida as capas
│   ├── VerificadorDeLink       confere o link do próximo capítulo no site de leitura
│   ├── BuscadorHttp            abre páginas de outros sites, só os públicos
│   ├── SinopseService          descrição e tags vindas da internet
│   └── RecomendacaoService     recomendações, busca geral e nomes alternativos
├── repository/         persistência
│   ├── MangaRepository         interface
│   ├── JsonMangaRepository     arquivo mangas.json
│   ├── PostgresMangaRepository tabela mangas
│   ├── ImagemRepository        interface, com versão em pasta e em Postgres
│   └── ImportacaoDeArquivos    copia o arquivo local para um banco vazio
├── util/               validação dos campos obrigatórios
└── web/                HTTP
    ├── ApiServer       rotas, login, proteções e tradução de erros
    └── MangaResponse   formato do mangá na resposta
```

Decisões que valem saber:

- **Sem framework de injeção.** O `App` cria os objetos e passa uns para os outros pelo construtor. Isso deixa os
  testes simples: basta passar um repositório em pasta temporária ou um cliente HTTP de mentira.
- **O serviço nunca altera o mangá guardado.** Ele monta uma cópia com as mudanças e manda salvar. Se a gravação
  falhar, o que estava guardado continua intacto.
- **Trabalho de rede fora da trava.** A verificação de link consulta outro site, o que demora. Ela roda sem travar
  o serviço e, na hora de gravar, confere se o mangá não mudou nesse meio tempo.
- **O domínio não conhece JSON.** O formato gravado fica em `MangaJson`, no repositório.

## Versão JavaScript

```
api/
├── index.js           rotas, login, regras do mangá e acesso ao Postgres
├── _verificador.js    espelha VerificadorDeLink e BuscadorHttp
├── _sinopse.js        espelha SinopseService
└── _recomendacoes.js  espelha RecomendacaoService
```

Os arquivos que começam com `_` não viram rotas no Vercel; são módulos usados pelo `index.js`.
O `vercel.json` manda toda chamada `/api/qualquer/coisa` para a função única `api/index.js`, serve o site a partir
de `src/main/resources/public` e dá 30 segundos de limite à função, porque algumas rotas consultam outros sites.

## Front-end

Fica em `src/main/resources/public`: `index.html`, `app.css`, `app.js` e `favicon.svg`. Não há etapa de build nem
biblioteca. Na versão Java, os arquivos são servidos de dentro do `.jar`; no Vercel, como arquivos estáticos.
Detalhes em [07 · Interface](07-interface.md).

## Segurança

- **Login.** HTTP Basic, com usuário e senha vindos da configuração. A versão Java se recusa a aceitar conexões
  de fora do computador sem uma senha de pelo menos 12 caracteres; a versão do Vercel responde com erro até a
  senha ser configurada.
- **Outros sites não alteram dados.** Requisições que mudam algo e vêm de outra origem são recusadas.
- **Conteúdo.** O site só carrega scripts e estilos dele mesmo (Content-Security-Policy). Texto vindo de fora
  (títulos, tags, descrições) entra na página sempre como texto, nunca como HTML.
- **Capas.** O tipo é conferido pelo conteúdo do arquivo, e o nome é gerado pelo servidor, o que impede acesso a
  arquivos fora da pasta de imagens.
- **Consultas a outros sites.** Só endereços públicos, nas portas padrão; links que apontam para a rede interna do
  servidor são recusados, inclusive após redirecionamento.
- **Extensão.** Só obedece ao site que o dono liberar. Veja [08 · Extensão e atalho](08-extensao-e-atalho.md).
