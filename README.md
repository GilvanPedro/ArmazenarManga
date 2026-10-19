# Viracap

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

O site tem duas partes: a **Biblioteca**, com a lista de mangás de cada conta, e a **Comunidade**, no estilo do
Twitter: posts com imagens e listas de mangás, curtidas, comentários, seguir leitores e um feed "Para você".

Cada pessoa cria a sua conta (e-mail, nick, senha e, se quiser, uma foto de perfil) e vê só os mangás que ela
mesma cadastrou. O banco aguenta
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
| [Contas de usuário](docs/23-contas.md) | [Foto de perfil](docs/24-foto-de-perfil.md) |
| [Página da conta centralizada](docs/25-pagina-da-conta-centralizada.md) | [Mangás antigos só para admins](docs/26-mangas-antigos-so-para-admins.md) |
| [Biblioteca e Comunidade](docs/27-biblioteca-e-comunidade.md) | [Comunidade](docs/28-comunidade.md) |
| [Comunidade centralizada](docs/29-comunidade-centralizada.md) | [Lista publicada em janela](docs/30-lista-publicada-em-janela.md) |
| [Montar a lista pela Biblioteca](docs/31-montar-lista-pela-biblioteca.md) | [Filtro de tag na Biblioteca](docs/32-filtro-de-tag-na-biblioteca.md) |
| [Escala da Comunidade e aviso de posts novos](docs/33-escala-da-comunidade.md) | [Tags da Biblioteca como no Descobrir](docs/34-tags-da-biblioteca-como-no-descobrir.md) |
| [Detalhe da lista sem status](docs/35-detalhe-da-lista-sem-status.md) | [Post aberto em tela própria](docs/36-post-aberto.md) |
| [Botão de Tags na Biblioteca](docs/37-botao-de-tags-na-biblioteca.md) | [Clicar fora fecha a janela](docs/38-clicar-fora-fecha-a-janela.md) |
| [Lista publicada sem status nas capas](docs/39-lista-sem-status-nas-capas.md) | [Campo de tags como barra de pesquisa](docs/40-campo-de-tags-como-barra-de-pesquisa.md) |
| [Comunidade mais larga](docs/41-comunidade-mais-larga.md) | [Responsividade em celulares, tablets e monitores](docs/42-responsividade.md) |
| [Feed da Comunidade no meio da tela](docs/43-feed-no-meio-da-tela.md) | [Site no Google](docs/44-site-no-google.md) |
| [Extensão no Firefox](docs/45-extensao-no-firefox.md) | [Novo nome: Viracap](docs/46-nome-viracap.md) |
| [Botões de seguir sincronizados](docs/47-botoes-de-seguir-sincronizados.md) | [Moderação e robô de imagens](docs/48-moderacao-da-comunidade.md) |
| [Perfil, busca e configurações](docs/49-perfil-busca-e-configuracoes.md) | [Empacotar a extensão](docs/50-empacotar-a-extensao.md) |
| [Sugestões na busca e seus posts no topo](docs/51-sugestoes-e-ordem-do-feed.md) | [Feed por data, abas e seguidores](docs/52-feed-por-data-abas-e-seguidores.md) |
| [Botão "Lido" maior e mais para cima](docs/53-botao-lido-maior-e-mais-alto.md) | [Nome do site no Google e apresentação](docs/54-nome-do-site-e-apresentacao.md) |
| [Link da extensão na loja do Firefox](docs/55-link-da-extensao-no-firefox.md) | [Painel dos administradores](docs/56-painel-dos-administradores.md) |
| [Loja de bordas e mochila](docs/57-loja-de-bordas.md) | [Finanças: ganho e perda do site](docs/58-financas.md) |
| [Efeitos, Loja no topo e painel do dono](docs/59-efeitos-loja-no-topo-e-dono.md) | [Bordas ornamentadas](docs/60-bordas-ornamentadas.md) |
| [O dono tem todos os itens da loja](docs/61-dono-tem-todos-os-itens.md) | [Borda Celestial, feita de imagem](docs/62-borda-celestial-de-imagem.md) |
| [Imagens da loja no banco](docs/63-imagens-da-loja-no-banco.md) | [Os mangás do perfil e a lista de um só](docs/64-mangas-do-perfil-e-lista-de-um.md) |
| [A borda da pessoa nos mangás do perfil](docs/65-bordas-nos-mangas-do-perfil.md) | [Capturas da tela para o Google](docs/66-capturas-da-tela-no-google.md) |
| [Temas do site](docs/67-temas-do-site.md) | [Mais efeitos e o filtro da mochila](docs/68-mais-efeitos-e-filtro-da-mochila.md) |
| [Temas animados Galáxia e Fazenda](docs/69-temas-galaxia-e-fazenda.md) | [Tema Silhueta e o tema no perfil](docs/70-tema-silhueta-e-tema-no-perfil.md) |
| [Meteoros no tema Galáxia](docs/71-meteoros-na-galaxia.md) | [Sem tema de imagem de fundo](docs/72-sem-tema-de-imagem.md) |
| [O tema da pessoa no perfil e nas listas](docs/73-tema-da-pessoa-no-perfil-e-nas-listas.md) | [Curtir sem abrir o post](docs/74-curtir-sem-abrir-o-post.md) |
| [Otimização geral do site](docs/75-otimizacao-geral.md) | [Banners de anúncio: cadastro e relatórios](docs/76-banners-de-anuncio.md) |
| [Sem a aba Imagens da loja](docs/77-sem-a-aba-imagens-da-loja.md) | [Imagens da loja: aba do dono e terminal](docs/78-imagens-da-loja-pelo-terminal.md) |
| [A borda Celestial usa o canvas.png](docs/79-celestial-com-canvas-png.md) | [Banner vertical recomendado: 400 × 1280](docs/80-banner-vertical-400x1280.md) |
| [A receita dos banners e a pizza das Finanças](docs/81-receita-dos-banners-e-pizza-das-financas.md) | |
| [O término do banner e o seletor de mês](docs/82-termino-do-banner-e-seletor-de-mes.md) | |
| [Bordas Aurora Boreal e Eclipse](docs/83-bordas-aurora-boreal-e-eclipse.md) | |
| [Quatro molduras de imagem na loja](docs/84-quatro-molduras-de-imagem.md) | |
| [Capas altas esticando e molduras encostando](docs/85-capas-altas-e-molduras-vizinhas.md) | |
| [Efeitos Retícula, Linhas de Ação e Feixes de Luz](docs/86-efeitos-reticula-linhas-de-acao-e-feixes.md) | |
| [Temas Entardecer, Festival de Verão e Página de Mangá](docs/87-temas-entardecer-festival-e-pagina-de-manga.md) | |
| [Robô de imagens mais rigoroso](docs/88-robo-de-imagens-mais-rigoroso.md) | |
| [Robô de imagens com a moderação da OpenAI](docs/89-robo-de-imagens-com-a-openai.md) | |
| [Temas animados mais vivos](docs/90-temas-animados-mais-vivos.md) | |
| [Os lugares de banner no site](docs/91-lugares-de-banner.md) | |
| [Banners laterais no meio da tela](docs/92-banners-laterais-no-meio-da-tela.md) | |
| [A página do mangá no meio da tela](docs/93-pagina-do-manga-no-meio.md) | |
| ["Com tags em comum" e "recomendados" encaixados](docs/94-parecidos-e-recomendados-encaixados.md) | |
| [Banners na página do mangá e no formulário](docs/95-banners-na-pagina-do-manga-e-no-formulario.md) | |
| [Banner com imagem horizontal e vertical](docs/96-banner-com-imagem-horizontal-e-vertical.md) | |
| [Banner vertical com as medidas do horizontal](docs/97-banner-vertical-com-as-medidas-do-horizontal.md) | |
| [O "+ Adicionar" dos recomendados alinhado](docs/98-botao-adicionar-alinhado.md) | |
| [Barras de rolagem na cor do tema](docs/99-barras-de-rolagem-do-tema.md) | |
| [O site muito mais leve para o processador](docs/100-site-muito-mais-leve.md) | |
| [Obra nova com o começo do nome de uma da lista](docs/101-obra-nova-com-nome-parecido.md) | |
| [Descrição sempre em português](docs/102-descricao-sempre-em-portugues.md) | |
| [Descrição e tags de vários sites](docs/103-descricao-e-tags-de-varios-sites.md) | |
| [O site aberto para quem não tem conta](docs/104-site-aberto-sem-conta.md) | |
| [A página inicial abre o site, sem pedir conta](docs/105-pagina-inicial-sem-conta.md) | |

## Testes

```bash
mvn package    # versão Java
npm test       # versão JavaScript
```
