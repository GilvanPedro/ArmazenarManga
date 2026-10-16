# 28 · Comunidade

Mudança feita em outubro de 2026: a aba **Comunidade**, que até então era só uma página "Em breve" (veja
[Biblioteca e Comunidade](27-biblioteca-e-comunidade.md)), passou a funcionar, no estilo do Twitter.

A Comunidade existe **só na versão do Vercel**, que é a publicada. Na versão Java a página avisa que ela está
indisponível.

## O que dá para fazer

- **Postar:** texto de até 500 caracteres, até **4 imagens** e, se quiser, uma **lista de mangás** anexada. O post
  precisa ter pelo menos uma das três coisas.
- **Escrever de dois jeitos:** pelo campo no alto do feed ("O que você está lendo?") ou pelo **botão redondo ✎** no
  canto da tela, que abre a janela de escrever em qualquer tela da Comunidade.
- **Imagens:** escolhidas do computador (botão "Imagem") ou **coladas com Ctrl+V** no campo de texto (um print, uma
  imagem copiada). O navegador diminui cada imagem para no máximo 1600 px antes de enviar; GIFs vão como estão,
  para não perder a animação. Clicar numa imagem do post abre ela grande.
- **Lista anexada:** o botão "Lista" abre a Biblioteca para escolher de 1 a 20 mangás (com busca pelo nome) e dar um
  título à lista, se quiser. O post mostra o texto em cima e a lista embaixo, como um retweet com comentário. Depois,
  a lista no post virou um cartão com uma capa só, que abre a lista inteira numa janela: veja
  [Lista publicada em janela](30-lista-publicada-em-janela.md).
- **Curtir** (♥) e **comentar** (💬). Os comentários abrem embaixo do post. Depois, clicar no post ou no 💬 passou a
  abrir o post em tela própria: veja [Post aberto em tela própria](36-post-aberto.md).
- **Seguir** leitores: pelo botão "Seguir" ao lado do nome nos posts, nas sugestões "Quem seguir" ou no perfil.
  Todos os botões da mesma pessoa mudam juntos: veja [Botões de seguir sincronizados](47-botoes-de-seguir-sincronizados.md).
- **Perfil** de cada leitor (`#/comunidade/perfil/{id}`): foto, nick, desde quando está na Comunidade, número de
  posts, seguidores e seguindo, e os posts dele. No próprio perfil, dá para postar e há o link "Editar perfil".
- **Apagar:** o próprio post; comentários no próprio post ou escritos por você. Admins podem apagar qualquer post e
  comentário.

## Os dois feeds

- **Seguindo:** os posts de quem você segue e os seus, do mais novo para o mais antigo.
- **Para você:** os posts de todo mundo, ordenados por pontos. Cada post ganha pontos pela **proximidade** de quem
  lê com o autor e pelo **interesse** que despertou, e perde com o **tempo**:

```
pontos = (1 + proximidade + 2 × ln(1 + curtidas + 2 × comentários)) ÷ (horas desde o post + 2) ^ 1,2
```

A proximidade com um autor soma:

| O quê | Pontos |
|-------|-------:|
| Você segue o autor | 10 |
| Cada post dele que você curtiu nos últimos 60 dias | 2 |
| Cada post dele que você comentou nos últimos 60 dias | 3 |
| Teto | 40 |
| Seus próprios posts | 5 |

Assim, quem você segue e com quem você interage aparece mais, posts muito curtidos e comentados sobem, e posts
antigos vão descendo. O teto impede que uma única pessoa tome conta do feed. O feed considera os 1000 posts mais
recentes e carrega 20 por vez, conforme a página desce.

## Privacidade

- O **nick e a foto de perfil** passam a ser vistos por quem está logado, na Comunidade. Antes, a foto só era vista
  pela própria conta. O **e-mail nunca** aparece para os outros.
- A **Biblioteca continua privada**. Só o que é anexado num post fica visível: a lista leva uma **cópia** de cada
  mangá como estava ao publicar (título, capa, status, nota, favorito e capítulo). Mudar a Biblioteca depois não
  muda o post.
- As capas enviadas são privadas; a lista leva uma **cópia pequena** delas (a miniatura, quando existe), guardada
  com o post. A capa original continua privada.
- Tudo na Comunidade pede login.
- **Excluir a conta** apaga os posts, as curtidas, os comentários, quem ela segue, quem a segue e as imagens dela.

## Limites

| O quê | Limite por conta |
|-------|------------------|
| Posts | 30 por hora |
| Comentários | 60 por hora |
| Imagens enviadas | 60 por hora, até 2 MB cada |
| Imagens por post | 4 |
| Mangás por lista | 20 |
| Texto de post e de comentário | 500 caracteres |

Imagens enviadas que não chegaram a ser usadas num post são apagadas depois de um dia.

## O que mudou no servidor

Tabelas novas (criadas sozinhas, só acrescentando): `posts` (texto, nomes das imagens, a lista em JSON), `curtidas`,
`comentarios`, `seguindo` e `imagens_da_comunidade`. Todas apontam para a conta de quem escreveu e são apagadas
junto com ela.

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/feed?feed=para-voce\|seguindo\|perfil` | Abre um feed (ids e os 20 primeiros); as páginas seguintes vêm por `posts?ids=`. Veja [Escala da Comunidade](33-escala-da-comunidade.md) |
| `POST` | `/api/comunidade/posts` | Publica `{texto, imagens: [nomes], lista: {titulo, mangas: [ids]}}` |
| `GET`, `DELETE` | `/api/comunidade/posts/{id}` | Um post; apagar (autor ou admin) |
| `POST`, `DELETE` | `/api/comunidade/posts/{id}/curtida` | Curtir e descurtir |
| `GET`, `POST` | `/api/comunidade/posts/{id}/comentarios` | Comentários do post; comentar `{texto}` |
| `DELETE` | `/api/comunidade/comentarios/{id}` | Apagar (quem escreveu, o dono do post ou admin) |
| `POST` | `/api/comunidade/imagens` | Envia uma imagem para um post (`multipart/form-data`, campo `arquivo`) |
| `GET` | `/api/comunidade/imagens/{nome}` | Uma imagem de post ou de lista |
| `GET` | `/api/comunidade/contas/{id}` | Perfil: nick, foto, posts, seguidores, seguindo e se você segue |
| `POST`, `DELETE` | `/api/comunidade/contas/{id}/seguir` | Seguir e deixar de seguir |
| `GET` | `/api/comunidade/contas/{id}/foto` | Foto de perfil do leitor |
| `GET` | `/api/comunidade/sugestoes` | Até 5 leitores para seguir: os que mais postaram no último mês e que você ainda não segue |

Cada post devolvido traz o autor (id, nick e foto), o texto, os endereços das imagens, a lista, a data, quantas
curtidas e comentários tem, se você curtiu, se você segue o autor, se é seu e se você pode apagá-lo.

## Arquivos

| Arquivo | O que tem |
|---------|-----------|
| `api/_comunidade.js` | Novo: regras do post, do comentário e da lista, e os pesos do feed |
| `api/_comunidade_rotas.js` | Novo: tabelas e rotas da Comunidade |
| `api/index.js` | Cria as tabelas e passa `/api/comunidade/...` para as rotas novas |
| `public/app.js`, `public/app.css` | Feed, campo e janela de escrever, botão ✎, posts, lista anexada, comentários, perfil e "Quem seguir" |
| `test-api/comunidade.test.mjs` | Novo: testes das regras |

## Testes

- JavaScript (61 no total, 4 a mais): post precisa de texto, imagem ou lista; limites de texto, imagens e mangás;
  nomes de imagem inválidos; texto limpo; lista anexada; e a ordem do feed (seguir e curtir sobem, o tempo derruba,
  a proximidade tem teto).
- Conferido à mão contra um banco Postgres local, com três contas: post sem conteúdo e longo demais recusados;
  lista com mangá de outra conta recusada; imagem de outra conta recusada; capa copiada visível para os outros e a
  original não; seguir a si mesmo recusado; curtir duas vezes conta uma; quem pode apagar comentários e posts; os
  dois feeds; perfil; sugestões; sem login e de outro site recusados; e excluir a conta apaga os posts e as cópias.
- No navegador, com duas contas: feed vazio, post com uma imagem escolhida e outra colada, post pelo botão ✎ com
  lista (busca na Biblioteca, três mangás, título), seguir, curtir, comentar, feed Seguindo, perfil, imagem grande e
  o celular.
- A versão Java não ganhou nada novo (289 testes, sem mudança).

## O que ficou de fora

- Repostar (retweet) e citar o post de outra pessoa.
- Notificações (curtiram, comentaram, seguiram você).
- Editar um post depois de publicado.
- Denunciar e bloquear contas, e ferramentas de moderação para admins.
- A Comunidade na versão Java.

> Depois, os admins ganharam suspensão, banimento e a aba Gerenciar, e as imagens passaram por um robô: veja
> [Moderação e robô de imagens](48-moderacao-da-comunidade.md).
