# 134 · Descobrir e recomendações mais rápidos

Uma análise do tempo de resposta do site, depois do Kitsu ([doc 132](132-kitsu-quando-o-anilist-cai.md)), e o que
foi melhorado.

## O Kitsu só entra com o AniList fora do ar

As recomendações de um mangá iam ao Kitsu sempre que o AniList não achava nada, inclusive com o AniList no ar (por
exemplo, para uma obra que ele não conhece). Isso somava ~1 s de espera sem necessidade. O AniList responde "não
encontrado" a uma busca de obra pelo nome do mesmo jeito que responde quando está fora, então agora, antes de ir ao
Kitsu, o site faz uma pergunta curta de lista ao AniList: o Kitsu só entra se ela também falhar.

O Descobrir já só usava o Kitsu com o AniList fora do ar.

## As buscas do Descobrir ficam guardadas por 10 minutos

Cada página do Descobrir ia ao AniList toda vez, até para voltar à página anterior. Agora as obras de cada busca
(nome, tags, ordem e página) ficam guardadas no servidor por 10 minutos, para todos: voltar a uma página, sortear de
novo ou outra pessoa fazer a mesma busca sai na hora. O que muda de pessoa para pessoa (esconder quem já está na lista
dela) continua sendo feito a cada pedido.

## Os nomes da lista não seguram mais a página

Para esconder do Descobrir e das recomendações o que já está na lista, o servidor descobre os outros nomes de cada
mangá (o original, em outras línguas, apelidos), perguntando ao AniList, ao MangaDex e a um tradutor. Um desses fora do
ar fazia cada pedido esperar até 6 segundos, e a página do Descobrir esperava tudo isso antes de buscar as obras.

Agora:

- os nomes da lista e as obras são buscados **ao mesmo tempo**;
- a página espera os outros nomes por **no máximo 1,5 s**; o que chegar depois fica salvo para a próxima vez;
- um título que ficou sem resposta não é procurado de novo por **15 minutos** naquele servidor.

## No site

- **Descobrir:** as obras começam a ser pedidas junto com a lista de tags, em vez de esperar por ela.
- **Favoritar:** a estrela muda na hora do clique, sem esperar o servidor; se ele recusar, volta como estava.
- **Lista da Biblioteca guardada:** qualquer ação que mudava algo no servidor (curtir um post, girar a roleta,
  salvar um banner…) fazia o site esquecer a lista da Biblioteca e baixá-la de novo ao voltar. Agora só as ações que
  mexem nos mangás, na conta ou na sessão fazem isso.

## Medidas (ambiente de teste, com um usuário logado)

| O quê | Antes | Depois |
|-------|-------|--------|
| Descobrir, primeira página, com mangás da lista sem os outros nomes ainda | 7,2 s | 1,5 s |
| Voltar a uma página do Descobrir já vista | 0,37 s | 0,006 s |
| Página nova do Descobrir (pedida primeiro na versão nova) | ~1,0 s | ~0,4 s |
| Estrela de favorito mudar depois do clique | o tempo da resposta | na hora |

A página nova do Descobrir mede quase o mesmo nas duas versões quando o AniList não guardou a busca; o que muda é não
esperar os nomes e não buscar de novo o que já foi buscado.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_recomendacoes.js` | O Kitsu só com o AniList fora; as buscas guardadas por 10 minutos; os nomes da lista podem chegar como promessa |
| `api/index.js` | `nomesDosCadastrados` com o limite de 1,5 s e a pausa de 15 minutos; nomes e obras ao mesmo tempo |
| `public/app.js` | Descobrir pedindo obras e tags juntas; favoritar na hora; a lista só esquecida depois de mexer nos mangás |
| `test-api/recomendacoes.test.mjs` | Testes do Kitsu só com o AniList fora e das buscas guardadas |
