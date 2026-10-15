# Meus Mangás

Site pessoal para acompanhar mangás, manhwas e webtoons: guarda o que está sendo lido, em que capítulo a leitura
parou e em qual site, e leva direto ao próximo capítulo.

O diferencial é partir do lugar onde a leitura acontece. Cada mangá tem o link do site de leitura, e o sistema
confere e corrige esse link quando o site muda o endereço.

## O que ele faz

- **Lista** com capa, status, último capítulo, tags, descrição e dia de lançamento, com busca, filtros,
  ordenação, paginação e sorteio. A busca, os filtros e as páginas respondem na hora, e as capas usam
  miniaturas leves.
- **Botão Ler**, que abre o próximo capítulo no site salvo e confere o link antes.
- **Marcar como lido** direto da página do capítulo, por uma extensão de navegador ou um favorito.
- **Lançam hoje**: os mangás em leitura que lançam capítulo no dia e ainda não foram lidos.
- **Nota** de 0 a 10 para cada mangá, mostrada na capa com um ícone de ruim, médio, bom ou muito bom, e
  ordenação pelas melhores ou piores notas.
- **Favoritos**, destacados na lista com borda roxa, um brilho discreto e estrela.
- **Cadastro pré-preenchido**, com nome, capa, tags e descrição em português buscados na internet.
- **Recomendações** e uma aba para **descobrir** obras por nome, ordem, tags que você quer e tags que não
  quer (em quadros com pesquisa, que podem ser recolhidos), sem repetir o que já está na lista.

Cada pessoa cria a sua conta (e-mail, nick e senha) e vê só os mangás que ela mesma cadastrou. O banco aguenta
milhares de mangás por conta. O login dura 30 dias no navegador, mesmo desligando o computador.

## Como rodar

Precisa do JDK 25 ou mais novo e do Maven.

```bash
./iniciar.sh
```

O site abre em `http://localhost:7070`; na primeira vez, crie uma conta na tela de entrada. Os dados ficam em
`~/.mangatracker/`. Para usar um banco de dados ou
publicar na internet, veja [Hospedagem e configuração](docs/09-hospedagem.md).

## Tecnologias

- **Back-end:** Java 25 com Javalin, em camadas (domínio, serviço, repositório e web).
- **Segunda versão da API:** JavaScript, para hospedagem no Vercel (pasta `api/`).
- **Dados:** arquivo JSON no uso local, PostgreSQL (Neon) na hospedagem.
- **Front-end:** HTML, CSS e JavaScript puros, sem etapa de build.
- **Extensão de navegador:** Manifest V3 (pasta `extensao/`).
- **Testes:** JUnit e o executor de testes do Node.

## Estrutura

```
src/main/java/…/mangatracker   back-end Java
src/main/resources/public      o site
src/test                       testes do back-end Java
api/                           versão JavaScript da API
test-api/                      testes da versão JavaScript
extensao/                      extensão de navegador
ferramentas/                   scripts de manutenção
docs/                          documentação
```

## Documentação

A pasta [docs](docs/README.md) tem um documento para cada assunto:

| | |
|---|---|
| [Visão geral](docs/01-visao-geral.md) | [Arquitetura](docs/02-arquitetura.md) |
| [Dados](docs/03-dados.md) | [API](docs/04-api.md) |
| [Links e leitura](docs/05-links-e-leitura.md) | [Recomendações](docs/06-recomendacoes.md) |
| [Interface](docs/07-interface.md) | [Extensão e atalho](docs/08-extensao-e-atalho.md) |
| [Hospedagem e configuração](docs/09-hospedagem.md) | [Testes](docs/10-testes.md) |
| [Histórico](docs/11-historico.md) | [Próximos passos](docs/12-proximos-passos.md) |
| [Filtro de tags no Descobrir](docs/13-filtro-de-tags-no-descobrir.md) | [Recolher as tags no Descobrir](docs/14-recolher-tags-no-descobrir.md) |
| [Nota dos mangás](docs/15-nota-dos-mangas.md) | [Favoritos e ordem pela nota](docs/16-favoritos-e-ordem-pela-nota.md) |
| [Favorito de "marcar como lido" que não abria](docs/17-favorito-que-nao-abria.md) | [Selo da nota com ícone](docs/18-selo-da-nota-com-icone.md) |
| [Destaque roxo do favorito](docs/19-destaque-roxo-do-favorito.md) | [Tela de login de 30 dias](docs/20-tela-de-login.md) |
| [Desempenho da lista, da busca e das capas](docs/21-desempenho.md) | [Escala e preparação para contas](docs/22-escala-e-contas.md) |
| [Contas de usuário](docs/23-contas.md) | |

## Testes

```bash
mvn package    # versão Java
npm test       # versão JavaScript
```
