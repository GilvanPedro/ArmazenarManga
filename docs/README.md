# Documentação do Viracap

Cada documento trata de um assunto. Leia na ordem se estiver conhecendo o projeto, ou vá direto ao que precisa.

| Documento | Do que trata |
|-----------|--------------|
| [01 · Visão geral](01-visao-geral.md) | O que o sistema é, o que ele faz e quais são os limites de hoje |
| [02 · Arquitetura](02-arquitetura.md) | Como o código está organizado, as camadas e as duas versões do servidor |
| [03 · Dados](03-dados.md) | O que é guardado de cada mangá e onde (arquivo JSON ou Postgres) |
| [04 · API](04-api.md) | Todas as rotas HTTP, com parâmetros e respostas |
| [05 · Links e leitura](05-links-e-leitura.md) | Modelo do link, botão Ler, verificação de link e marcar capítulo como lido |
| [06 · Recomendações](06-recomendacoes.md) | Descrição automática, recomendações, aba Descobrir e como evitar repetir o que já está na lista |
| [07 · Interface](07-interface.md) | As telas do site e como o front-end funciona |
| [08 · Extensão e atalho](08-extensao-e-atalho.md) | A extensão de navegador e o favorito de "marcar como lido" |
| [09 · Hospedagem e configuração](09-hospedagem.md) | Como rodar localmente e publicar (Vercel, Render, Neon) |
| [10 · Testes](10-testes.md) | O que é testado, como rodar e o que não tem teste automático |
| [11 · Histórico](11-historico.md) | Como o projeto foi feito: o que entrou, o que mudou e o que foi removido |
| [12 · Próximos passos](12-proximos-passos.md) | Limitações conhecidas e o que pode ser adicionado |
| [13 · Filtro de tags no Descobrir](13-filtro-de-tags-no-descobrir.md) | A mudança que trouxe a pesquisa de tags e as tags excluídas à aba Descobrir |
| [14 · Recolher as tags no Descobrir](14-recolher-tags-no-descobrir.md) | A mudança que permite recolher a lista de tags dos dois quadros de uma vez |
| [15 · Nota dos mangás](15-nota-dos-mangas.md) | A mudança que trouxe a nota de 0 a 10, o selo na capa e a rota para dar nota |
| [16 · Favoritos e ordem pela nota](16-favoritos-e-ordem-pela-nota.md) | A mudança que trouxe os favoritos destacados e a ordenação pela nota |
| [17 · Favorito que não abria](17-favorito-que-nao-abria.md) | A correção do favorito de "marcar como lido" em sites que impedem abrir aba nova |
| [18 · Selo da nota com ícone](18-selo-da-nota-com-icone.md) | O ajuste que trocou o indicativo da nota por um ícone e aumentou o selo na capa |
| [19 · Destaque roxo do favorito](19-destaque-roxo-do-favorito.md) | O ajuste visual do favorito: borda roxa, reflexo na capa e efeito ao passar o mouse |
| [20 · Tela de login de 30 dias](20-tela-de-login.md) | A tela de entrada própria, o login que dura 30 dias, o botão de sair e a proteção contra tentativas |
| [21 · Desempenho](21-desempenho.md) | Lista, busca e capas em menos de 2 segundos: início em uma chamada, lista guardada no navegador, miniaturas e recarregar a aba |
| [22 · Escala e preparação para contas](22-escala-e-contas.md) | Lista feita pelo banco, índices, dono em cada registro e o que falta para o cadastro de contas |
| [23 · Contas de usuário](23-contas.md) | Cadastro, login por e-mail, página da conta, exclusão e como trazer os mangás de antes das contas |
| [24 · Foto de perfil](24-foto-de-perfil.md) | A foto de perfil da conta e a ferramenta que passa os mangás antigos para uma conta pelo e-mail |
| [25 · Página da conta centralizada](25-pagina-da-conta-centralizada.md) | O ajuste que centralizou a página Minha conta |
| [26 · Mangás antigos só para admins](26-mangas-antigos-so-para-admins.md) | Quem é admin (`MANGATRACKER_ADMIN_EMAIL`) e a transferência dos mangás antigos só para admins |
| [27 · Biblioteca e Comunidade](27-biblioteca-e-comunidade.md) | As duas partes do site no topo e a página "Em breve" da Comunidade |
| [28 · Comunidade](28-comunidade.md) | Posts com imagens e listas, curtidas, comentários, seguir, perfis e o feed "Para você" |
| [29 · Comunidade centralizada](29-comunidade-centralizada.md) | O ajuste que deixou o feed da Comunidade no meio da tela |
| [30 · Lista publicada em janela](30-lista-publicada-em-janela.md) | A lista no post com uma capa só, a janela com todos os mangás e o mangá em detalhe |
| [31 · Montar a lista pela Biblioteca](31-montar-lista-pela-biblioteca.md) | A janela de montar a lista como uma Biblioteca simplificada, com a posição de cada mangá na capa |
| [32 · Filtro de tag na Biblioteca](32-filtro-de-tag-na-biblioteca.md) | O seletor de tags ao lado da ordenação, na lista da Biblioteca |
| [33 · Escala da Comunidade](33-escala-da-comunidade.md) | Comunidade para mil leitores ao mesmo tempo e o aviso de 10 ou mais posts novos |
| [34 · Tags da Biblioteca como no Descobrir](34-tags-da-biblioteca-como-no-descobrir.md) | O quadro de tags da Biblioteca, com pesquisa e várias tags |
| [35 · Detalhe da lista sem status](35-detalhe-da-lista-sem-status.md) | O mangá da lista publicada sem o status, e fechar o detalhe voltando à lista |
| [36 · Post aberto em tela própria](36-post-aberto.md) | Clicar num post abre ele maior, com os comentários, e voltar devolve o feed no mesmo ponto |
| [37 · Botão de Tags na Biblioteca](37-botao-de-tags-na-biblioteca.md) | O quadro de tags virou um botão ao lado da ordenação, com painel flutuante |
| [38 · Clicar fora fecha a janela](38-clicar-fora-fecha-a-janela.md) | Clicar no fundo de qualquer janela flutuante faz o mesmo que fechá-la |
| [39 · Lista publicada sem status nas capas](39-lista-sem-status-nas-capas.md) | As capas da lista mostram só a nota, sem o status |
| [40 · Campo de tags como barra de pesquisa](40-campo-de-tags-como-barra-de-pesquisa.md) | O campo de pesquisar tag do painel com altura normal, e o painel dentro da tela no celular |
| [41 · Comunidade mais larga](41-comunidade-mais-larga.md) | O feed com até 860 px, as abas sem barra de rolagem e "Lista" sem emoji |
| [42 · Responsividade](42-responsividade.md) | Análise em 14 tamanhos de tela e as correções para celular, tablet, telas baixas, toque e monitores grandes |
| [43 · Feed no meio da tela](43-feed-no-meio-da-tela.md) | O feed da Comunidade exatamente no meio da tela, com o "Quem seguir" à direita |
| [44 · Site no Google](44-site-no-google.md) | Descrição, prévia ao compartilhar, robots.txt, sitemap.xml e os passos no Google Search Console |
| [45 · Extensão no Firefox](45-extensao-no-firefox.md) | A declaração de dados que a Mozilla exige e como enviar a extensão |
| [46 · Novo nome: Viracap](46-nome-viracap.md) | O site e a extensão passaram de "Meus Mangás" para "Viracap" |
| [47 · Botões de seguir sincronizados](47-botoes-de-seguir-sincronizados.md) | Seguir alguém atualiza todos os botões daquela pessoa na tela |
| [48 · Moderação e robô de imagens](48-moderacao-da-comunidade.md) | Suspender e banir contas, a aba Gerenciar e o robô que barra fotos explícitas |
| [49 · Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md) | Mangás e descrição no perfil, Editar perfil, Configurações separadas, Seguir no post aberto e busca por pessoas e #tags |
| [50 · Empacotar a extensão](50-empacotar-a-extensao.md) | Os zips para o Firefox e o Chrome sem os avisos da Mozilla, e o Firefox para Android |
| [51 · Sugestões na busca e seus posts no topo](51-sugestoes-e-ordem-do-feed.md) | Até 3 sugestões enquanto se digita, seus posts nunca abaixo de posts mais antigos dos outros, e o limite de cadastro |
| [52 · Feed por data, abas e seguidores](52-feed-por-data-abas-e-seguidores.md) | O "Para você" do mais novo para o mais antigo, as abas na linha da busca e as listas de seguidores e seguindo no perfil |
| [53 · Botão "Lido" maior e mais para cima](53-botao-lido-maior-e-mais-alto.md) | O botão da extensão nos sites de leitura saiu do canto de baixo e ficou maior (versão 1.4.2) |
| [54 · Nome do site no Google e apresentação](54-nome-do-site-e-apresentacao.md) | Dados estruturados com o nome Viracap e um texto sobre o site embaixo do formulário de entrar |
| [55 · Link da extensão na loja do Firefox](55-link-da-extensao-no-firefox.md) | A aba Extensão e atalho leva à loja do Firefox, sem as instruções por arquivo |
| [56 · Painel dos administradores](56-painel-dos-administradores.md) | Acessos, usuários ativos e contas criadas por dia e por mês, na aba Painel do Gerenciar |
| [57 · Loja de bordas e mochila](57-loja-de-bordas.md) | Bordas para os favoritos a R$ 4,50, pagas pelo Mercado Pago, e a mochila para equipar |
| [58 · Finanças: ganho e perda do site](58-financas.md) | Gastos e receitas do site mês a mês, com pizzas, ganho e perda de 12 meses e o histórico das vendas da loja |
| [59 · Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md) | Efeitos a R$ 2,50 para os favoritos, a Loja ao lado da Comunidade, centralizada e com páginas, e Painel e Finanças só para o dono |
| [60 · Bordas ornamentadas](60-bordas-ornamentadas.md) | Sete bordas novas com enfeites que saem da capa: Cristal, Cyberpunk, Abissal, Sombrio, Floresta, Elétrico e Arcano |
| [61 · O dono tem todos os itens da loja](61-dono-tem-todos-os-itens.md) | A conta do dono do site tem todas as bordas e efeitos, os de hoje e os futuros, sem comprar |
| [62 · Borda Celestial, feita de imagem](62-borda-celestial-de-imagem.md) | A primeira borda feita a partir de uma imagem, e como fazer as próximas |
| [63 · Imagens da loja no banco](63-imagens-da-loja-no-banco.md) | As imagens das bordas e efeitos ficam no banco, enviadas pela aba "Imagens da loja" do Gerenciar |
| [64 · Os mangás do perfil e a lista de um só](64-mangas-do-perfil-e-lista-de-um.md) | Clicar no número de mangás do perfil mostra os mangás da pessoa; lista de um mangá abre direto nele |
| [65 · A borda da pessoa nos mangás do perfil](65-bordas-nos-mangas-do-perfil.md) | Os favoritos abertos pelo perfil aparecem com a borda e o efeito que a pessoa equipou |
| [66 · Capturas da tela para o Google](66-capturas-da-tela-no-google.md) | Imagens da Biblioteca, da Comunidade e de um mangá na página inicial, nos dados estruturados e no sitemap |
| [67 · Temas do site](67-temas-do-site.md) | Escuro e claro de graça, cinco temas de cor (R$ 5,00) e quatro de fundo animado (R$ 7,50) na loja |
| [68 · Mais efeitos e o filtro da mochila](68-mais-efeitos-e-filtro-da-mochila.md) | Seis efeitos novos (Brasas, Chuva, Corações, Glitch, Tela CRT e Confete) e o filtro por tipo na mochila |
| [69 · Temas animados Galáxia e Fazenda](69-temas-galaxia-e-fazenda.md) | Dois temas de fundo animado novos: nebulosas girando e uma fazenda com nuvens passando |
| [70 · Tema Silhueta e o tema no perfil](70-tema-silhueta-e-tema-no-perfil.md) | Um tema com ilustração de fundo (do banco) e a janela dos mangás do perfil com o tema da pessoa |
| [71 · Meteoros no tema Galáxia](71-meteoros-na-galaxia.md) | Meteoros cruzando a tela de vez em quando no tema animado Galáxia |
| [72 · Sem tema de imagem de fundo](72-sem-tema-de-imagem.md) | O tema Silhueta saiu da loja; quem o tinha equipado volta ao Automático |
| [73 · O tema da pessoa no perfil e nas listas](73-tema-da-pessoa-no-perfil-e-nas-listas.md) | O perfil, os mangás e as listas de outra pessoa aparecem com o tema, a borda e o efeito dela |
| [74 · Curtir sem abrir o post](74-curtir-sem-abrir-o-post.md) | Curtir não abre mais o post (só comentar abre), e os botões de curtir e comentar ficaram maiores |
| [75 · Otimização geral do site](75-otimizacao-geral.md) | Site compactado no Vercel com cache de um ano, a estrutura do banco só quando muda, acesso numa ida ao banco e fundos animados mais leves |
| [76 · Banners de anúncio: cadastro e relatórios](76-banners-de-anuncio.md) | O cadastro dos banners horizontais e verticais e os relatórios para as empresas, na aba Banners do Gerenciar do dono |
| [77 · Sem a aba Imagens da loja](77-sem-a-aba-imagens-da-loja.md) | A aba de enviar imagens saiu do Gerenciar; a imagem da borda Celestial continua sendo servida |
| [78 · Imagens da loja: aba do dono e terminal](78-imagens-da-loja-pelo-terminal.md) | A aba Imagens da loja de volta, só na conta do dono, e uma ferramenta para guardar as imagens pelo terminal |
| [79 · A borda Celestial usa o canvas.png](79-celestial-com-canvas-png.md) | A moldura da Celestial vem da imagem `canvas.png`, o arquivo original |
| [80 · Banner vertical recomendado: 400 × 1280](80-banner-vertical-400x1280.md) | O tamanho recomendado do banner vertical passou a ser 400 × 1280, o espelho do horizontal |
| [81 · A receita dos banners e a pizza das Finanças](81-receita-dos-banners-e-pizza-das-financas.md) | A pizza de receita e despesa (do mês ou geral), e no banner o peso melhor, o valor que ele rende (nas Finanças) e a data em que acaba |
| [82 · O término do banner e o seletor de mês](82-termino-do-banner-e-seletor-de-mes.md) | O quadro "Quando ele acaba" com atalhos e resumo, e o seletor de mês com calendário |
| [83 · Bordas Aurora Boreal e Eclipse](83-bordas-aurora-boreal-e-eclipse.md) | Duas bordas animadas novas: as cores da aurora correndo pela moldura, e a luz dourada do eclipse com o anel de diamante |
| [84 · Quatro molduras de imagem na loja](84-quatro-molduras-de-imagem.md) | Arte Derretida, Relíquia, Bosque Élfico e Portão do Inferno, feitas das imagens enviadas, com brilho e luz no canto |
| [85 · Capas altas esticando e molduras encostando](85-capas-altas-e-molduras-vizinhas.md) | Imagens altas não esticam mais a capa com borda, as molduras de imagem não encostam nas vizinhas, e as imagens dos posts dividem a altura por igual |
| [86 · Efeitos Retícula, Linhas de Ação e Feixes de Luz](86-efeitos-reticula-linhas-de-acao-e-feixes.md) | Três efeitos novos vindos do mangá e do cinema, e o brilho da Celestial sem esbranquiçar a capa |
| [87 · Temas Entardecer, Festival de Verão e Página de Mangá](87-temas-entardecer-festival-e-pagina-de-manga.md) | Três temas animados de anime: o pôr do sol com postes e fios, o matsuri com lanternas e fogos, e a página de mangá |
| [88 · Robô de imagens mais rigoroso](88-robo-de-imagens-mais-rigoroso.md) | O robô deixava passar 4 de 5 imagens explícitas de teste: outro modelo, a imagem encaixada e o limite em 60% |
| [89 · Robô de imagens com a moderação da OpenAI](89-robo-de-imagens-com-a-openai.md) | A moderação gratuita da OpenAI decide (com o modelo local de reserva), sem barrar foto comum por engano; como ligar a chave |
| [90 · Temas animados mais vivos](90-temas-animados-mais-vivos.md) | Os nove temas animados mais rápidos e com camadas novas: pássaros, estrelas cadentes, cortina de luz, raios de sol, linhas de ação |
| [91 · Os lugares de banner no site](91-lugares-de-banner.md) | Os banners do Gerenciar aparecem no site (laterais, em cima e embaixo, conforme a tela), com exibições e cliques contados, e o "Anuncie aqui" quando não há banner |
| [92 · Banners laterais no meio da tela](92-banners-laterais-no-meio-da-tela.md) | Os verticais da Loja, do Descobrir e da Comunidade na altura do meio da tela |
| [93 · A página do mangá no meio da tela](93-pagina-do-manga-no-meio.md) | As informações de um mangá num bloco no meio da tela, e a capa no meio no celular |
| [94 · "Com tags em comum" e "recomendados" encaixados](94-parecidos-e-recomendados-encaixados.md) | Capas menores, 6 numa linha no computador e 3 por linha no celular, sem obra sobrando |
| [95 · Banners na página do mangá e no formulário](95-banners-na-pagina-do-manga-e-no-formulario.md) | Mais lugares de banner: laterais ou horizontais na página do mangá e no Novo mangá / Edição geral |
| [96 · Banner com imagem horizontal e vertical](96-banner-com-imagem-horizontal-e-vertical.md) | Um banner pode ter a imagem horizontal, a vertical ou as duas (pelo menos uma) e aparece nos lugares dos dois formatos |
| [97 · Banner vertical com as medidas do horizontal](97-banner-vertical-com-as-medidas-do-horizontal.md) | O vertical é o horizontal em pé: 50–2000 × 300–4000 px, altura de 2 a 11 vezes a largura |
| [98 · O "+ Adicionar" dos recomendados alinhado](98-botao-adicionar-alinhado.md) | Os botões dos recomendados (e do Descobrir) no mesmo nível, com qualquer quantidade de tags |
| [99 · Barras de rolagem na cor do tema](99-barras-de-rolagem-do-tema.md) | Barras de rolagem finas, na cor de destaque do tema equipado, no site todo |
| [100 · O site muito mais leve para o processador](100-site-muito-mais-leve.md) | As animações de bordas, efeitos e temas reescritas para não redesenhar a página (de até 857 ms/s para 1 ms/s), e pausadas fora da tela e com a janela sem foco |
| [101 · Obra nova com o começo do nome de uma da lista](101-obra-nova-com-nome-parecido.md) | Ao marcar capítulo lido, uma obra nova que começa com o nome de outra não é mais confundida, e há um botão para cadastrar como nova |
| [102 · Descrição sempre em português](102-descricao-sempre-em-portugues.md) | A descrição buscada é traduzida pelo Google (com o MyMemory de reserva), conferida, e traduzida de novo ao salvar se ainda estiver em inglês |
| [103 · Descrição e tags de vários sites](103-descricao-e-tags-de-varios-sites.md) | A busca usa MangaDex, AniList, MangaUpdates, MyAnimeList e Kitsu ao mesmo tempo, e junta as tags de todos os que acharam a mesma obra |
| [104 · O site aberto para quem não tem conta](104-site-aberto-sem-conta.md) | Sem conta, dá para ver a Comunidade, a loja e o Descobrir; cadastrar, postar, curtir, comentar, seguir, abrir listas, ver os mangás de alguém e comprar levam para criar conta |
| [105 · A página inicial abre o site, sem pedir conta](105-pagina-inicial-sem-conta.md) | Sem conta, a página inicial mostra as boas-vindas e o Descobrir; entrar e criar conta só quando a pessoa pede ou precisa |
| [106 · "Todos os mangás" sem conta leva para criar conta](106-todos-os-mangas-sem-conta.md) | A aba que não fazia nada sem conta agora abre criar conta |
| [107 · Tema Palácio Zen, com fundo em vídeo](107-tema-palacio-zen-em-video.md) | O primeiro tema com vídeo de fundo, escurecido, que pausa sem foco |
| [108 · Palácio Zen: o vídeo no banco e as cores da pintura](108-tema-palacio-no-banco-e-cores.md) | O vídeo no banco (só carrega com o tema), e os botões, o topo e os favoritos com as cores da pintura |
| [109 · Temas Primavera em Kyoto e Lâmina Sombria](109-temas-kyoto-e-lamina-sombria.md) | Mais dois temas em vídeo: um claro em pixel art e um escuro em preto e branco |
| [110 · Pré-visualizar os itens da loja na sua Biblioteca](110-pre-visualizar-itens-da-loja.md) | Uma janela com a sua Biblioteca com o tema, a borda ou o efeito, antes de comprar |
| [111 · Otimização dos temas animados e dos vídeos no celular](111-otimizacao-dos-temas-e-celular.md) | O reflexo dos favoritos, Aurora e Galáxia sem blur, Kyoto em 640 × 360, vídeos em pé no celular e a rolagem da pré-visualização |
| [112 · Temas animados a 30 quadros por segundo e vídeos a 24](112-temas-animados-a-30-quadros.md) | Os fundos e enfeites animados num relógio de 30 quadros por segundo, e os vídeos a 24 |
| [113 · Sem a borda Arte Derretida](113-sem-a-borda-arte-derretida.md) | A borda que era a mesma moldura da Celestial saiu da loja |
| [114 · Sorteio no estilo de abrir um baú](114-sorteio-estilo-abrir-bau.md) | A fita de capas que para no sorteado, a moldura dourada, o confete e os botões de ler |
| [115 · Roleta da loja](115-roleta-da-loja.md) | Um giro grátis por conta e giros a R$ 5,00 (até 3 ao mesmo tempo) que sorteiam um item que a pessoa não tem |
| [116 · Roleta para quem já tem todos os itens](116-roleta-com-todos-os-itens.md) | Sem itens faltando, a roleta não vende nem gira; a mensagem certa |
| [117 · "Roleta" sem emoji](117-roleta-sem-emoji.md) | A aba e o título da roleta só com o nome |
| [118 · Roleta: o prêmio no meio da mira e só o que falta na fita](118-roleta-premio-no-meio-e-so-o-que-falta.md) | O prêmio desliza até o meio da mira, e a fita só mostra os itens que a pessoa ainda não tem |
| [119 · Botões da roleta e as partes do site no celular](119-roleta-e-partes-do-site-no-celular.md) | Biblioteca, Comunidade e Loja numa barra com ícones no celular, e os botões da roleta em blocos |
| [120 · O prêmio da roleta centralizado](120-premio-da-roleta-centralizado.md) | A capa do prêmio (e dos cartões da loja) no meio, e sem o "null" na demonstração |
| [121 · Roleta mais leve](121-roleta-mais-leve.md) | O brilho do giro grátis, as pontas da fita e a mira sem redesenhar, e as casas copiadas |
| [122 · Tag do Google (Google Ads)](122-tag-do-google.md) | A tag do Google Ads em todas as páginas, a política de segurança e as imagens dos temas que não apareciam |
| [123 · Sorteio no Descobrir](123-sorteio-no-descobrir.md) | Um botão que sorteia uma obra que ainda não está na lista, com a busca e as tags escolhidas |
| [124 · "Sortear de novo" com resposta na hora, e o confete de volta](124-sortear-de-novo-e-confete.md) | O botão mostra "Sorteando…" até o próximo chegar, e o confete que a política de segurança barrava |
| [125 · Imagens de banner de até 4 MB, e a imagem nova na hora](125-banners-maiores-e-imagem-nova-na-hora.md) | O limite das imagens de banner foi de 1 para 4 MB, e a imagem trocada aparece sem esperar |
| [126 · As duas imagens no relatório do banner](126-as-duas-imagens-no-relatorio-do-banner.md) | O relatório mostra a imagem horizontal e a vertical, não só a horizontal |
| [127 · Banner ampliado no relatório](127-banner-ampliado-no-relatorio.md) | Clicar numa imagem do banner no relatório abre ela grande, numa janela por cima |
| [128 · Os banners trocam junto com a página](128-banners-trocam-com-a-pagina.md) | Mudar de página na Biblioteca, em Lançam hoje e no Descobrir sorteia os banners de novo |
| [129 · A página atual na cor do tema](129-pagina-atual-na-cor-do-tema.md) | O número da página atual na paginação fica na cor de destaque do tema |
| [130 · Extensão e atalho centralizada, com os banners dos lados](130-atalho-centralizado-com-banners-dos-lados.md) | O texto no meio, um banner vertical de cada lado na tela grande e horizontais em cima e embaixo no celular |
| [131 · Banners mais leves](131-banners-mais-leves.md) | As imagens dos banners diminuídas e em WebP, guardadas na CDN e carregadas só quando chegam perto da tela |
| [132 · Kitsu quando o AniList cai](132-kitsu-quando-o-anilist-cai.md) | O Descobrir e as recomendações usam o Kitsu quando o AniList não responde (ele desligou a API em 21/10/2026) |
| [133 · Título bagunçado ao marcar capítulo lido](133-titulo-baguncado-na-captura.md) | O nome do mangá sai limpo do título da página, e o mangá também é reconhecido pelo nome no endereço |
| [134 · Descobrir e recomendações mais rápidos](134-descobrir-e-recomendacoes-mais-rapidos.md) | O Kitsu só com o AniList fora, buscas guardadas, nomes da lista sem segurar a página e favoritar na hora |
| [135 · "Sortear de novo" que fugia do clique no Firefox](135-sortear-de-novo-no-firefox.md) | Uma barra de rolagem aparecia no meio do clique e tirava o botão de baixo do mouse |
| [136 · Comunidade mais rápida](136-comunidade-mais-rapida.md) | Feed guardado e pedido antes do clique, posts fora da tela sem desenhar e o servidor na região do banco |
| [137 · Repost, citação e quem curtiu](137-repost-citacao-e-quem-curtiu.md) | Repostar e citar posts como no X, e o dono do post vê quem curtiu |
| [138 · Ícones no lugar dos emojis nos posts](138-icones-no-lugar-dos-emojis.md) | Comentários, repost, curtidas, quem curtiu, apagar, escrever, imagem e lista com ícones de linha que seguem o tema |
| [139 · Imagens no Vercel Blob, em AVIF e no tamanho certo](139-imagens-no-vercel-blob.md) | As imagens vão para o Vercel Blob em várias larguras, AVIF e WebP, sem metadados, com prévia borrada; o banco guarda só os dados |
| [140 · Todas as imagens no Blob](140-todas-as-imagens-no-blob.md) | Banners, imagens e vídeos da loja, miniaturas e capas de listas também vão para o Blob; nada novo nasce no banco |

O arquivo [Ideia_Principal.md](Ideia_Principal.md) é o planejamento original, escrito antes do código. Ele foi
mantido como estava; o [histórico](11-historico.md) mostra o que mudou em relação a ele.
