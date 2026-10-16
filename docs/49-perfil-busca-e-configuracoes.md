# 49 · Perfil, busca e configurações

Mudanças feitas em outubro de 2026 na Comunidade (veja [Comunidade](28-comunidade.md)). Como o resto da Comunidade,
só existem na versão do Vercel.

## O que mudou

### Perfil

- **Quantidade de mangás.** O perfil de qualquer pessoa mostra quantos mangás ela tem na Biblioteca, junto de posts,
  seguidores e seguindo. Só o número aparece; a lista continua privada.
- **Descrição.** Cada perfil pode ter uma descrição de até **300 caracteres**, que todos veem embaixo do nick. As
  `#tags` dela viram links para a busca. Quem está suspenso ou banido não pode trocar a descrição (pode apagá-la).
- **O seu perfil fica como os outros veem.** Clicar no seu nick no topo agora abre o **seu perfil** (antes abria a
  página da conta). Nele aparecem dois botões:
  - **Editar perfil:** abre uma janela por cima do perfil com a foto (salva na hora em que é escolhida), o nick e a
    descrição (com contador até 300). "Salvar" grava o nick e a descrição e redesenha o perfil.
  - **⚙ Configurações:** a página da conta.

### Configurações

A antiga "Minha conta" virou **Configurações** e ficou só com o que é da conta: e-mail, senha, mangás de antes das
contas (admins) e excluir a conta. No lugar de foto e nick, uma seção "Perfil" leva ao seu perfil, e o "voltar" volta
para ele.

Na versão Java, que não tem Comunidade nem perfil, nada disso muda: o nick no topo leva às Configurações, e foto e
nick continuam lá. O site sabe qual é a versão pelo campo `comunidade: true` que só o `/api/inicio` do Vercel manda.

### Post aberto

Ao abrir um post, o botão **Seguir** aparece sempre ao lado do nome de quem escreveu (menos nos seus posts): "Seguir"
se você ainda não segue, "Seguindo" se já segue, com a opção de deixar de seguir dali. No feed continua como antes:
o botão só aparece para quem você ainda não segue.

### Busca

- Um botão **🔍 Buscar** no fim da linha das abas da Comunidade ("Para você", "Seguindo") abre a busca
  (`#/comunidade/busca`).
- **Texto:** procura **pessoas** pelo nick (o nick exato primeiro, depois quem tem mais seguidores; o `@` do começo é
  ignorado) e **posts** que têm aquele texto, do mais novo para o mais antigo.
- **`#tag`:** procura só os **posts com aquela hashtag**, sem diferenciar maiúsculas e minúsculas (`#frieren` acha
  `#Frieren`).
- O que foi digitado vai para o endereço (`#/comunidade/busca?q=...`), então dá para voltar e compartilhar a busca.
  A busca roda sozinha enquanto se digita.

### Hashtags

Nos posts, nos comentários e na descrição do perfil, toda `#tag` (letras, inclusive com acento, números e `_`, até 50)
vira um link para a busca dela. O `#` precisa estar no começo ou depois de um espaço ou pontuação: em `a#b` não há
hashtag.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/contas/{id}` | O perfil passa a trazer `descricao` e `mangas` |
| `PUT` | `/api/comunidade/perfil` | Salva a descrição do próprio perfil: `{ descricao }` (vazia apaga) |
| `GET` | `/api/comunidade/pessoas?q=` | Até 20 pessoas pelo nick |
| `GET` | `/api/comunidade/feed?feed=busca&q=` | Posts da busca (por texto ou `#tag`), paginados como os outros feeds |
| `GET` | `/api/inicio` | Passa a trazer `comunidade: true` (só na versão do Vercel) |

No banco, a tabela `contas` ganhou a coluna `descricao` (texto, vazio por padrão), criada sozinha na primeira chamada.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade.js` | `validarDescricao`, `hashtagsDo`, `lerBusca` e `escaparLike` |
| `api/_comunidade_rotas.js` | Coluna `descricao`; perfil com descrição e mangás; rota da descrição; busca de pessoas e feed de busca |
| `api/index.js` | `comunidade: true` no `/api/inicio` |
| `public/app.js` | Tela de busca e botão Buscar; hashtags como links; Seguir no post aberto; perfil com descrição, mangás, Editar perfil e Configurações; janela de editar perfil; o nick do topo leva ao perfil; Configurações sem foto e nick |
| `public/app.css` | Estilos do perfil, da janela de editar, das hashtags e da busca |
| `test-api/comunidade.test.mjs` | Testes da descrição, das hashtags e do que a busca entende |

## Testes

- `npm test`: 69 testes passando (3 novos).
- No navegador:
  - o perfil da Bia mostra "3 mangás", a descrição e o Seguir;
  - descrição com 301 caracteres é recusada;
  - no post aberto, o botão aparece ("Seguir" e, depois de seguir e reabrir, "Seguindo");
  - a hashtag do post vira link;
  - Buscar abre a busca com o campo focado;
  - buscar pelo nick acha a Bia;
  - buscar por texto acha o post certo;
  - `#frieren…` em minúsculas acha só o post com a tag (e não o "a#Frieren…");
  - clicar numa hashtag leva à busca dela;
  - o nick do topo leva ao próprio perfil, inclusive logo depois de entrar pela tela de login;
  - Editar perfil salva nick e descrição e atualiza o topo;
  - Configurações têm só Perfil, E-mail, Senha e Excluir conta, com "← Meu perfil";
  - nenhum texto "null" solto em seis telas;
  - no celular, sem rolagem para o lado.
- Os testes da versão Java continuam passando.
