# 104 · O site aberto para quem não tem conta

Antes, quem não tinha conta só via a tela de entrar. Agora o site abre **sem conta** para ver o que é público, e
qualquer coisa que precise de conta leva para a tela de **criar conta**, com o motivo em destaque ("Crie uma conta
para curtir posts."). Criando a conta (ou entrando), a pessoa volta para a mesma tela onde estava.

## O que dá para ver sem conta

- **Comunidade:** o feed "Para você", os posts abertos, os comentários, os perfis, quem segue e quem é seguido, a
  busca de pessoas, posts e #tags, e o "Quem seguir".
- **Loja:** as bordas, os efeitos e os temas, com as prévias.
- **Descobrir:** a busca de obras para ler, com as tags.
- **Extensão e atalho.**
- A página inicial continua sendo a tela de entrar com a apresentação do site (a que o Google mostra).

No topo, no lugar da conta, ficam **Entrar** e **Criar conta**; o "+ Adicionar" some.

## O que pede conta

| Ação | O que acontece sem conta |
|------|-------------------------|
| Cadastrar mangá (Novo mangá, "+ Adicionar" do Descobrir, marcar capítulo lido) | Criar conta: "Crie uma conta para cadastrar os seus mangás." |
| Biblioteca, Lançam hoje, página de um mangá | Tela de entrar (a Biblioteca) ou criar conta (as outras) |
| Postar (no lugar do campo, um convite; o botão ✎) | Criar conta |
| Curtir, comentar (no lugar do campo de comentário, um convite), seguir | Criar conta |
| Abrir as listas de mangás dos posts | Criar conta |
| Ver os mangás cadastrados de um leitor (no perfil) | Criar conta |
| Comprar e equipar na loja; a Mochila | Criar conta |
| O feed "Seguindo" | Criar conta |
| Configurações, Gerenciar | Tela de entrar |

Na tela de criar conta ou de entrar, aparece **"Continuar sem conta: ver a Comunidade e a loja"**, e o topo continua
lá: dá para voltar a explorar.

## No servidor

As rotas que pedem login continuam pedindo; sem login, só passam as de **leitura (GET)** listadas em
`api/_visitante.js` (`rotaDeVisitante`): o feed, os posts, os comentários, as imagens dos posts, os perfis, os
seguidores, a busca e as sugestões da Comunidade; a vitrine da loja; o Descobrir (recomendações, ordens e tags) e as
listas fixas. Elas rodam como um **visitante** (`VISITANTE`), uma "conta" com um id que não existe: não curtiu nada,
não segue ninguém, não tem itens nem mangás. O resto responde **401 "Crie uma conta ou entre para continuar"**,
inclusive os mangás e as capas de um perfil, postar, curtir, comentar, seguir, comprar e equipar.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_visitante.js` (novo) | O visitante e as rotas que ele pode chamar |
| `api/index.js` | Sem login, as rotas do visitante passam com o visitante; o resto, 401 |
| `public/index.html` | Os botões Entrar e Criar conta no topo |
| `public/app.js` | O site abre sem conta; `ehVisitante`, `exigirConta`, `conviteParaConta` e `motivoParaConta`; as telas e as ações que pedem conta; a tela de entrar com o topo e o "Continuar sem conta"; o motivo em destaque |
| `public/app.css` | O convite para criar conta e o motivo na tela de criar conta |
| `test-api/visitante.test.mjs` (novo) | O que o visitante pode e não pode chamar |

## Como foi testado

- Os 112 testes passam.
- Pela API, sem login: o feed, um post, os comentários, um perfil, os seguidores, as sugestões, a busca, a loja, o
  Descobrir e as tags responderam 200; os mangás de um perfil, a situação, a lista de mangás, a conta, o
  gerenciamento, postar, curtir, comentar, seguir, comprar, equipar, cadastrar e os banners do Gerenciar, 401.
- No navegador, sem conta: a Comunidade, um perfil, a loja e o Descobrir abriram com Entrar e Criar conta no topo; o
  Seguindo, a Mochila, Lançam hoje, Novo mangá, a página de um mangá e o marcar capítulo lido levaram para criar conta
  com o motivo certo; curtir, postar (convite e ✎), seguir (sugestão e perfil), os mangás do perfil, comprar e o "+
  Adicionar" do Descobrir também; num post aberto, o convite apareceu no lugar do campo de comentar. Criando a conta
  pelo convite de curtir, voltou para a Comunidade já com a conta, e curtir funcionou.
- Com conta, as telas de sempre abriram como antes. O site compactado também foi conferido.

> Depois, a página inicial passou a abrir o site direto, sem a tela de entrar: veja [A página inicial abre o site, sem pedir conta](105-pagina-inicial-sem-conta.md).
