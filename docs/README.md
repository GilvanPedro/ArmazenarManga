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

O arquivo [Ideia_Principal.md](Ideia_Principal.md) é o planejamento original, escrito antes do código. Ele foi
mantido como estava; o [histórico](11-historico.md) mostra o que mudou em relação a ele.
