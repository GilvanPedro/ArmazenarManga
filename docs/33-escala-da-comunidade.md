# 33 · Escala da Comunidade e aviso de posts novos

Mudança feita em outubro de 2026 na Comunidade (veja [Comunidade](28-comunidade.md)), com dois objetivos: aguentar
**mil leitores usando ao mesmo tempo** com resposta rápida, e avisar quem está rolando o feed quando chegam **10 ou
mais posts novos** no algoritmo dele, deixando a pessoa escolher quando atualizar.

## O que pesava

Medido com uma massa grande: **mil contas, 20 mil posts, 280 mil curtidas, 20 mil comentários e 30 mil relações de
seguir**.

- Para ordenar o feed "Para você", o banco **recontava** as curtidas e os comentários de mil posts a cada página.
- **Cada página** refazia a ordenação inteira (a página 5 custava o mesmo que a 1).
- A conta que derruba os posts com o tempo usava **números decimais exatos**, lentos para mil posts: era a maior parte
  do tempo.
- "Quem seguir" juntava todas as contas com todos os posts do mês a cada abertura.

## O que mudou

### Contadores no próprio post

Os posts ganharam as colunas `curtidas_total` e `comentarios_total`. **Gatilhos no banco** somam e subtraem a cada
curtida e comentário criado ou apagado, inclusive quando uma conta é excluída e as curtidas dela somem em cascata.
Os contadores dos posts que já existiam são preenchidos uma vez, na primeira chamada depois da atualização (20 mil
posts levaram cerca de 1 segundo). Foi conferido que os 20 mil ficaram iguais à contagem real.

### Ordem calculada uma vez por abertura

- Abrir o feed (`GET /api/comunidade/feed`) calcula a ordem uma vez e devolve os **ids dos 300 primeiros posts** e os
  **20 primeiros prontos**.
- As páginas seguintes são pedidas **pelos ids** (`GET /api/comunidade/posts?ids=…`, 20 por vez), sem recalcular nada.
- Por isso, rolar o feed **não repete nem pula posts**, mesmo com posts novos chegando enquanto a pessoa lê.
- Depois dos 300, o feed diz que eles acabaram e sugere atualizar.
- O mesmo vale para o feed "Seguindo" e para os posts de um perfil.

### Conta em ponto flutuante

A divisão pelo tempo passou a usar números de ponto flutuante. Só isso tirou cerca de 20 ms de cada abertura do
"Para você".

### "Quem seguir" guardado por um minuto

Quem mais postou no último mês é igual para todo mundo. Esse cálculo fica guardado por um minuto em cada cópia da
função; para cada leitor, só sai dele quem ele já segue.

### Imagens pela CDN

As imagens dos posts, as cópias das capas das listas e as fotos na Comunidade passaram a poder ficar guardadas na
**CDN do Vercel** (`Cache-Control: public, s-maxage`). O nome de cada imagem muda a cada envio, e o endereço da foto
leva o nome dela; por isso podem ficar guardadas para sempre. Na prática, com muitos leitores, a mesma imagem não
precisa passar pela função e pelo banco a cada pessoa que a vê.

Isso tem uma consequência: quem tiver o endereço de uma imagem da Comunidade consegue abri-la sem login, como num
Twitter. O endereço não dá para adivinhar, e essas imagens já eram feitas para serem vistas pelos outros leitores.
As capas da Biblioteca continuam privadas.

## Aviso de posts novos

- Enquanto o feed está aberto (e a aba do navegador está visível), o site pergunta ao servidor, **a cada 45
  segundos**, quantos posts novos entraram no feed desde que ele foi aberto (`GET /api/comunidade/novidades`).
- No **"Para você"**, só contam os posts novos que **entram no algoritmo da pessoa** (entre os 300 mais relevantes
  para ela). No **"Seguindo"**, os de quem ela segue. Os próprios posts não contam.
- Com **10 ou mais**, aparece no alto do feed o botão **"↑ 12 posts novos · Atualizar"**, preso no topo enquanto a
  pessoa rola. **O feed não pula sozinho**: só atualiza se a pessoa clicar.
- Ao clicar, o feed volta ao topo e abre de novo com **os posts novos primeiro** (na ordem de relevância) e o resto
  depois, como no Twitter.
- Sair da Comunidade para de perguntar.

## Resultado medido

Mesma massa de dados, servidor do Vercel rodando no computador contra um Postgres local. O tempo é o da função (o
que o banco e o servidor gastam), sem a rede.

| Chamada | Antes | Depois |
|---------|------:|-------:|
| Abrir o "Para você" | 39 ms | **8 ms** |
| Página 5 do "Para você" / mais 20 posts | 37 ms | **3 ms** |
| Abrir o "Seguindo" | 4 ms | 7 ms |
| Posts novos (a cada 45 s) | — | **5 ms** |
| Quem seguir | 17 ms | **3 ms** |
| Perfil | 3 ms | 2 ms |
| **Carga: 300 aberturas, 50 ao mesmo tempo** | 48 por segundo, metade em até 1,0 s | **237 por segundo**, metade em até 0,2 s |

Os números são do meio das medições (a mediana); a primeira chamada de cada série é mais lenta (até 46 ms). Na
carga, o servidor de teste era um processo só, com duas conexões ao banco; no Vercel, cada cópia da função atende
uma chamada por vez, e as cópias se multiplicam sozinhas.

O "Seguindo" ficou um pouco mais lento ao abrir porque passou a montar a ordem dos 300 primeiros de uma vez; as
páginas seguintes custam 3 ms.

### Uma estimativa para mil leitores

Se cada um de mil leitores abre o feed a cada dois minutos, carrega mais posts a cada 30 segundos e recebe a consulta
de posts novos a cada 45 segundos, o banco gasta por volta de **0,2 segundo de processamento a cada segundo** (cerca
de 230 chamadas por segundo). É uma estimativa feita com os números acima, e não uma medição com mil pessoas de
verdade; ela cabe na menor máquina do Neon com folga.

## Conexões com o banco: use o endereço com pooler

Com muitos leitores ao mesmo tempo, o Vercel abre muitas cópias da função, e cada uma abre conexões com o banco. O
endereço normal do Neon aceita poucas conexões. O Neon oferece um endereço **com pooler** (o nome do servidor tem
`-pooler`, e no painel aparece como *Pooled connection*), que aguenta milhares. Para mil leitores, troque a
`DATABASE_URL` no Vercel pelo endereço com pooler. O código já funciona com ele.

## O que mudou no servidor

| Rota | O que faz |
|------|-----------|
| `GET /api/comunidade/feed?feed=para-voce\|seguindo\|perfil&conta={id}` | Abre um feed: `{ids, itens, geradoEm}` (ids dos 300 primeiros, os 20 primeiros prontos) |
| `GET /api/comunidade/feed?…&novosDesde={data}` | Abre o "Para você" com os posts novos desde a data primeiro |
| `GET /api/comunidade/posts?ids=a,b,c` | Os posts desses ids (até 50), na mesma ordem |
| `GET /api/comunidade/novidades?feed=…&desde={data}` | `{novos}`: quantos posts novos entraram no feed desde a data (até 99) |

Saíram `GET /api/comunidade/posts?feed=…&pagina=N` e `GET /api/comunidade/contas/{id}/posts`, que viraram as rotas
acima.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade.js` | `POSTS_DO_FEED` (300) |
| `api/_comunidade_rotas.js` | Contadores e gatilhos, ordem por ids, rotas novas, posts novos, "Quem seguir" guardado, imagens pela CDN |
| `public/app.js`, `public/app.css` | Feed carregado por ids, consulta de posts novos e o botão de atualizar |

## Testes

- Medições acima, antes e depois, com a massa grande.
- No navegador: o feed carregou 100 posts rolando, sem nenhum repetido; com outro leitor publicando 12 posts, o botão
  "12 posts novos" apareceu sem mover o feed; ao clicar, os 12 vieram primeiro.
- Os contadores dos 20 mil posts conferidos contra a contagem real.
- Os 61 testes da versão JavaScript continuam passando. As rotas da Comunidade não têm teste automático.

> Depois, o "Para você" passou a ser exibido do mais novo para o mais antigo, e o `novosDesde` deixou de ser usado:
> veja [Feed por data, abas e seguidores](52-feed-por-data-abas-e-seguidores.md).
