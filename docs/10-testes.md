# 10 · Testes

## Como rodar

```bash
mvn package    # testes da versão Java (e gera o .jar)
npm test       # testes da versão JavaScript
```

Hoje são **253** testes na versão Java e **47** na versão JavaScript.

## Versão Java

Os testes ficam em `src/test/java`, um arquivo por parte do sistema:

| Arquivo | O que cobre |
|---------|-------------|
| `ChapterLinkTest` | Montagem do link, formatos de capítulo ",5", validação do modelo, dia da semana |
| `JsonMangaRepositoryTest` | Arquivo JSON: gravar, reabrir, ordem, arquivo corrompido, falha de gravação |
| `PostgresRepositoryTest` | Os mesmos comportamentos em um Postgres de verdade, e a importação do arquivo |
| `ImagemServiceTest` | Tipos de imagem, limite de tamanho, nomes fora da pasta |
| `MangaServiceTest` | Regras do mangá: cadastro, edição, progresso, tags, sorteio, lançamentos, verificação |
| `VerificadorDeLinkTest` | Verificação de link contra um site falso, e a recusa de endereços internos |
| `SinopseServiceTest` | Descrição: fontes, tradução, limpeza do texto, falhas |
| `RecomendacaoServiceTest` | Recomendações, busca geral, nomes alternativos, exclusão do que já está na lista |
| `ApiServerTest` | A API por HTTP de verdade: todas as rotas, login, paginação, proteções |

### Como os testes evitam depender da internet

- **Banco.** O `PostgresRepositoryTest` sobe um Postgres embutido só para o teste.
- **Sites de leitura.** A classe `SiteFalso` é um pequeno servidor em `127.0.0.1` que imita um site de mangá:
  páginas, redirecionamentos, respostas de erro. A verificação de link é testada com o mesmo código de rede que
  roda de verdade.
- **AniList, MangaDex e MyMemory.** São trocados por respostas prontas, no formato que cada serviço devolve.

## Versão JavaScript

Em `test-api/`, com o executor de testes do próprio Node:

| Arquivo | O que cobre |
|---------|-------------|
| `verificador.test.mjs` | Verificação de link, com um site falso local |
| `sinopse.test.mjs` | Descrição e tradução |
| `recomendacoes.test.mjs` | Recomendações, busca geral e nomes alternativos |

Os casos são os mesmos da versão Java, para garantir que as duas se comportam igual.

## O que não tem teste automático

- **O `api/index.js`**, que contém as rotas e as regras do mangá na versão do Vercel. Ele foi conferido rodando
  localmente, com um Postgres de teste, o mesmo roteiro de chamadas usado na versão Java, mas esse roteiro não
  está no repositório.
- **O front-end e a extensão.** Foram verificados dirigindo um navegador de verdade por todos os fluxos a cada
  mudança, mas esses roteiros também não estão no repositório.
- **O comportamento no Vercel em si.** Os testes locais imitam o roteamento dele.

Levar esses roteiros para o repositório é um dos [próximos passos](12-proximos-passos.md).
