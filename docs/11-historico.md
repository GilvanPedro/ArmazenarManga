# 11 · Histórico

Como o projeto chegou ao que é: o que entrou, o que mudou no caminho e o que foi removido. As datas são as dos
commits.

## Linha do tempo

### 29/09 · Planejamento

O projeto começou pelo documento [Ideia_Principal.md](Ideia_Principal.md): requisitos, validações e a estrutura
em camadas. A ideia era um programa de computador, com telas próprias.

### 02/10 · Primeira versão completa

- **Back-end em Java.** Existiam o domínio e o repositório em JSON; o serviço estava vazio e o código não
  compilava. Foram concluídos o serviço, as validações e a montagem do link a partir do modelo com `{cap}`.
- **De programa para site.** No lugar das telas de computador, entrou uma API HTTP com Javalin e um site em HTML,
  CSS e JavaScript puros, servido pelo próprio programa.
- **Capas.** Envio de imagem com validação pelo conteúdo do arquivo.
- **Login e proteções**, para poder abrir o site a outros computadores.

### 02/10 · Hospedagem

- **Fly.io** foi a primeira tentativa. Exigia cartão de crédito e o deploy não chegou a funcionar.
- **Postgres.** Hospedagens gratuitas não têm disco permanente, então os dados ganharam uma segunda forma de
  armazenamento, em banco (Neon), mantendo o arquivo JSON para uso local.
- **Render** foi configurado para rodar a versão Java.
- **Vercel** acabou sendo o escolhido. Como ele não roda Java, a API foi reescrita em JavaScript.

### 02/10 · Sorteio, concluídos e lançamentos

- Mangás concluídos passaram a oferecer "ler novamente" e "último capítulo" no lugar do "ler o próximo".
- Dia de lançamento e a aba "Lançam hoje".

### 05/10 · Links que mudam

- **Verificação de link**: o servidor abre o site de leitura, acha o próximo capítulo e corrige o cadastro.
- **Endereços exatos** por capítulo, para sites em que cada capítulo tem um id próprio.
- **Extensão de navegador e favorito**, para os sites que bloqueiam o servidor.
- **Marcar como lido** a partir da página do capítulo, com cadastro pré-preenchido para obras novas.
- **Descrição automática** em português.

### 05/10 a 06/10 · Lista grande e descoberta

- **Paginação** e nomes centralizados nos cartões.
- **Recomendações** na página do mangá.
- **Tags gerais**, com seletor no cadastro, tags clicáveis e mangás semelhantes da lista.
- **Nomes alternativos**, para não recomendar o que já está cadastrado com outro título.
- **Aba Descobrir** e **ordenação** da página principal.

### 06/10 a 08/10 · Ajustes

- A tag "Harem" passou a valer para os dois tipos que o AniList tem.
- O nome da obra passou a ser limpo de "[Manga] Manga…" e semelhantes ao marcar como lido.
- Mangás já lidos no dia saem da aba "Lançam hoje".

## O que mudou em relação ao planejamento

| Planejado | Como ficou | Por quê |
|-----------|------------|---------|
| Programa com telas (`ui/`) | Site com API | Para acessar de outros aparelhos |
| Status `QUERO_LER` | `LER`, mais `CANCELADO` | O enum já existia assim no código |
| Tags e descrição obrigatórias (no código inicial) | Opcionais | O documento de requisitos não as exigia |
| Só arquivo JSON | JSON ou Postgres | Hospedagem gratuita não tem disco permanente |
| Só Java | Java e JavaScript | A hospedagem escolhida não roda Java |
| Link montado só pelo modelo | Modelo, verificação e endereços exatos | Sites mudam o id do link |

## O que foi alterado depois de pronto

- **Sorteio.** Passou a deixar de fora concluídos e cancelados; depois voltou a incluir todos os status.
- **Campo de tags.** Era um texto separado por vírgulas; virou um seletor com sugestões e criação na hora.
- **Escolha do mangá ao marcar como lido.** Era uma lista suspensa; virou um campo de busca com sugestões.
- **Sugestão de mangá ao marcar como lido.** Comparava só o começo do endereço e sugeria errado; passou a exigir
  que a obra bata, pelo nome ou pelo endereço.
- **Exclusão de repetidos nas recomendações.** Começou comparando títulos, passou por uma consulta em memória da
  obra de cada título e terminou guardando os outros nomes junto de cada mangá.
- **Marcar como lido.** Passou a atualizar também o modelo do link, e a ler o número do capítulo do título da
  página quando o do endereço é um código interno.
- **Botões da paginação.** Aumentados.
- **Tags na aba Descobrir.** A linha de tags que rolava para o lado virou dois quadros com pesquisa, um para as
  tags pedidas e outro para as excluídas. Detalhes em [Filtro de tags no Descobrir](13-filtro-de-tags-no-descobrir.md).
  Depois os quadros ganharam um botão para recolher a lista, descrito em
  [Recolher as tags no Descobrir](14-recolher-tags-no-descobrir.md).
- **Nota dos mangás.** Cada mangá passou a poder ter uma nota de 0 a 10, mostrada em um selo na capa. Detalhes
  em [Nota dos mangás](15-nota-dos-mangas.md).
- **Favoritos e ordem pela nota.** Um mangá pode ser marcado como favorito e aparece com borda dourada e
  estrela; a lista ganhou as ordens por melhores notas, piores notas e favoritos primeiro. Detalhes em
  [Favoritos e ordem pela nota](16-favoritos-e-ordem-pela-nota.md).
- **Favorito de "marcar como lido".** Deixou de depender de um único `window.open`, que alguns sites de leitura
  bloqueiam, e passou a avisar quando falha. Detalhes em [Favorito que não abria](17-favorito-que-nao-abria.md).
- **Selo da nota.** O indicativo da faixa virou um ícone (um rosto para cada faixa) no lugar da bolinha e do
  nome escrito, e o selo na capa ficou maior. Detalhes em [Selo da nota com ícone](18-selo-da-nota-com-icone.md).
- **Destaque do favorito.** A borda dourada virou um degradê roxo com brilho, a capa ganhou um reflexo discreto
  e as capas passaram a reagir ao mouse. Detalhes em [Destaque roxo do favorito](19-destaque-roxo-do-favorito.md).
- **Login.** A janela de senha do navegador (HTTP Basic) foi substituída por uma tela de entrada própria, com
  login de 30 dias guardado em cookie, botão de sair e limite de tentativas erradas. Detalhes em
  [Tela de login de 30 dias](20-tela-de-login.md).
- **Desempenho.** O site passou a abrir com uma chamada só, a lista passou a ser guardada no navegador (busca,
  filtros e páginas sem esperar o servidor), as capas ganharam miniaturas e as novas vão reduzidas. Clicar na aba
  aberta recarrega. Detalhes em [Desempenho](21-desempenho.md).
- **Escala e contas.** A lista passou a ser feita pelo banco, com índices, e cada registro ganhou um dono (a conta
  `principal`, por enquanto), filtrado em toda consulta. Acima de 2 mil mangás, o site passa a buscar pelo
  servidor. Detalhes em [Escala e preparação para contas](22-escala-e-contas.md).
- **Contas de usuário.** Cadastro com e-mail único, nick e senha; login por e-mail; página da conta para editar e
  excluir; e a transferência dos mangás antigos para a conta de quem sabe a senha antiga do site, que vira admin.
  Detalhes em [Contas de usuário](23-contas.md).
- **Foto de perfil.** Cada conta pode ter uma foto, cortada em quadrado no navegador, que aparece no topo. Veio junto
  uma ferramenta para passar os mangás antigos para uma conta pelo e-mail. Detalhes em [Foto de perfil](24-foto-de-perfil.md).
- **Página da conta.** Passou a ficar numa coluna no meio da tela, com o cabeçalho centralizado. Detalhes em
  [Página da conta centralizada](25-pagina-da-conta-centralizada.md).
- **Mangás antigos só para admins.** A transferência deixou de pedir a senha antiga e passou a ser só para admins,
  definidos pela variável `MANGATRACKER_ADMIN_EMAIL`. Detalhes em [Mangás antigos só para admins](26-mangas-antigos-so-para-admins.md).
- **Biblioteca e Comunidade.** O topo ganhou as duas partes do site: a Biblioteca (tudo o que já existia) e a
  Comunidade, por enquanto uma página "Em breve". Detalhes em [Biblioteca e Comunidade](27-biblioteca-e-comunidade.md).
- **Comunidade.** Passou a funcionar, no estilo do Twitter: posts com imagens (coladas ou enviadas) e listas de
  mangás anexadas, curtidas, comentários, seguir, perfis e os feeds "Para você" e "Seguindo". Só na versão do
  Vercel. Detalhes em [Comunidade](28-comunidade.md).
- **Comunidade centralizada.** O feed passou a ficar exatamente no meio da tela, com "Quem seguir" ao lado. Detalhes
  em [Comunidade centralizada](29-comunidade-centralizada.md).
- **Lista publicada em janela.** No post, a lista virou um cartão com uma capa só; clicar abre a lista inteira, e
  clicar num mangá mostra nota, capítulo, tags e descrição de quando ela foi publicada. Detalhes em
  [Lista publicada em janela](30-lista-publicada-em-janela.md).
- **Montar a lista pela Biblioteca.** A janela de escolher os mangás da lista virou uma Biblioteca simplificada, com
  busca, filtro, ordem e a posição de cada escolhido na capa. Detalhes em
  [Montar a lista pela Biblioteca](31-montar-lista-pela-biblioteca.md).
- **Filtro de tag na Biblioteca.** A lista ganhou um seletor de tags ao lado da ordenação. Detalhes em
  [Filtro de tag na Biblioteca](32-filtro-de-tag-na-biblioteca.md).
- **Escala da Comunidade.** Contadores no próprio post, ordem do feed calculada uma vez e páginas pelos ids, e o aviso
  de 10 ou mais posts novos no algoritmo de cada pessoa. Detalhes em [Escala da Comunidade](33-escala-da-comunidade.md).
- **Tags da Biblioteca como no Descobrir.** O seletor virou o quadro de tags do Descobrir, com várias tags ao mesmo
  tempo. Detalhes em [Tags da Biblioteca como no Descobrir](34-tags-da-biblioteca-como-no-descobrir.md).
- **Detalhe da lista.** O mangá aberto dentro de uma lista publicada deixou de mostrar o status, e fechar o detalhe
  voltou a levar à lista. Detalhes em [Detalhe da lista sem status](35-detalhe-da-lista-sem-status.md).
- **Post aberto.** Clicar num post abre ele em tela própria, com os comentários embaixo; voltar devolve o feed no mesmo
  ponto. Detalhes em [Post aberto em tela própria](36-post-aberto.md).
- **Botão de Tags.** O quadro de tags da Biblioteca virou um botão ao lado da ordenação, que abre um painel flutuante.
  Detalhes em [Botão de Tags na Biblioteca](37-botao-de-tags-na-biblioteca.md).
- **Clicar fora fecha.** Clicar no fundo de qualquer janela flutuante faz o mesmo que o Esc dela. Detalhes em
  [Clicar fora fecha a janela](38-clicar-fora-fecha-a-janela.md).
- **Lista sem status nas capas.** A grade da lista publicada deixou de mostrar o status. Detalhes em
  [Lista publicada sem status nas capas](39-lista-sem-status-nas-capas.md).
- **Campo de tags.** O campo de pesquisar tag do painel deixou de ser um bloco gigante, e o painel parou de sair da
  tela no celular. Detalhes em [Campo de tags como barra de pesquisa](40-campo-de-tags-como-barra-de-pesquisa.md).
- **Comunidade mais larga.** O feed passou de 620 para 860 px, junto do "Quem seguir"; as abas perderam a barra de
  rolagem; e o rótulo "Lista" perdeu o emoji. Detalhes em [Comunidade mais larga](41-comunidade-mais-larga.md).
- **Responsividade.** O site foi analisado em 14 tamanhos de tela, do celular de 320 px ao monitor de 2560 px. Foram
  corrigidos o topo e o painel de Tags no tablet, a barra e as abas da Biblioteca no celular, as janelas no celular e
  em telas baixas, o zoom do iPhone nos campos, os botões pequenos para o dedo e o uso da largura em monitores grandes.
  Detalhes em [Responsividade](42-responsividade.md).
- **Feed no meio da tela.** O feed da Comunidade voltou a ficar exatamente no meio da tela, com o "Quem seguir" no
  espaço da direita e a Comunidade usando a largura toda. Detalhes em
  [Feed da Comunidade no meio da tela](43-feed-no-meio-da-tela.md).
- **Site no Google.** A página inicial ganhou descrição, prévia ao compartilhar o link, `robots.txt` e `sitemap.xml`.
  Detalhes, e os passos no Google Search Console, em [Site no Google](44-site-no-google.md).
- **Extensão no Firefox.** O manifesto passou a declarar os dados que a extensão envia ao site, como a Mozilla exige
  para publicar. Detalhes em [Extensão no Firefox](45-extensao-no-firefox.md).
- **Novo nome: Viracap.** O site e a extensão deixaram de se chamar "Meus Mangás", e o site passou para
  https://viracap.vercel.app. Detalhes em [Novo nome: Viracap](46-nome-viracap.md).
- **Botões de seguir.** Seguir já era salvo, mas os outros botões da mesma pessoa não mudavam, e parecia que não.
  Agora todos andam juntos. Detalhes em [Botões de seguir sincronizados](47-botoes-de-seguir-sincronizados.md).
- **Moderação.** Admins podem suspender e banir contas e têm a aba Gerenciar (contas e registro), e um robô barra
  fotos explícitas nos posts e nas fotos de perfil, deixando arte e capas de mangá passarem. Detalhes em
  [Moderação e robô de imagens](48-moderacao-da-comunidade.md).
- **Perfil, busca e configurações.** O perfil ganhou a quantidade de mangás e uma descrição; o seu perfil fica como os
  outros o veem, com "Editar perfil", e a conta virou "Configurações"; o post aberto mostra o Seguir; e a Comunidade
  ganhou busca por pessoas, texto e #tags. Detalhes em [Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md).
- **Empacotar a extensão.** Uma ferramenta monta os zips do Firefox e do Chrome, cada um com o seu manifesto, e a
  Mozilla parou de mostrar avisos. Detalhes em [Empacotar a extensão](50-empacotar-a-extensao.md).
- **Sugestões e ordem do feed.** A barra de pesquisa sugere até 3 itens (pessoas, #tags e posts); no "Para você", os
  seus posts não ficam mais embaixo de posts mais antigos dos outros ao recarregar; e o limite de cadastro passou para
  20 em 10 minutos. Detalhes em [Sugestões na busca e seus posts no topo](51-sugestoes-e-ordem-do-feed.md).
- **Feed por data e seguidores.** O "Para você" passou a mostrar os posts sempre do mais novo para o mais antigo (os
  pontos só escolhem quais entram), as abas foram para a mesma linha da barra de pesquisa, e no perfil dá para clicar
  nos seguidores e em "seguindo" para ver quem são. Detalhes em [Feed por data, abas e seguidores](52-feed-por-data-abas-e-seguidores.md).

## O que foi removido ou abandonado

- **Fly.io.** Abandonado. O `fly.toml` ficou no repositório sem uso.
- **Marcador `{idcapitulo}` no link.** Foi proposto para indicar onde fica o id do capítulo. Não foi implementado,
  porque o sistema descobre a posição sozinho ao comparar o link encontrado com o modelo.
- **Contornar a proteção contra robôs.** Considerado e descartado. A alternativa adotada foi ler a página no
  navegador do próprio usuário.
- **Consulta em memória das obras da lista.** Substituída pelos nomes guardados no banco, que não se perdem
  quando o servidor reinicia.
- **Verificação de link, extensão e endereços exatos.** Chegaram a ser retirados por um momento, quando não
  resolviam o caso de um site específico, e foram restaurados em seguida. Um ajuste que estava em andamento na
  extensão naquele momento se perdeu: fazê-la clicar em botões de "próximo" que não são links e mostrar o que
  encontrou quando falha. Ele está nos [próximos passos](12-proximos-passos.md).

## Problemas encontrados pelos testes

Alguns defeitos que os testes no navegador revelaram e que foram corrigidos antes de ir ao ar:

- A tela de detalhes mostrava a palavra "null" solta.
- Enviar a mesma capa duas vezes, quando o salvamento falhava por outro motivo, deixava um arquivo sem uso.
- A captura confundia um link para a página da obra com o "próximo capítulo".
- Digitar na busca e clicar logo em um mangá podia cancelar o carregamento da página dele.
- Uma capa acima do limite devolvia erro 500 em vez de uma mensagem clara.
