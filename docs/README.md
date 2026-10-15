# Documentação do Meus Mangás

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

O arquivo [Ideia_Principal.md](Ideia_Principal.md) é o planejamento original, escrito antes do código. Ele foi
mantido como estava; o [histórico](11-historico.md) mostra o que mudou em relação a ele.
