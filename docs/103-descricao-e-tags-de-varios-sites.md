# 103 · Descrição e tags de vários sites

A busca da descrição e das tags no cadastro ("Buscar na internet", e o preenchimento automático) usava só o MangaDex
e o AniList, um depois do outro. Um site pode ter as tags incompletas (o AniList dava só "Action, Fantasy" para
Raising Villains the Right Way) ou nem conhecer a obra. Agora são **cinco fontes**, pesquisadas **ao mesmo tempo**:

| Fonte | O que traz |
|-------|-----------|
| MangaDex | Descrição em português (escrita por pessoas), quando existe; temas e gêneros |
| AniList | Descrição em inglês; gêneros e os temas fortes (60% ou mais, sem spoilers) |
| MangaUpdates | Descrição; gêneros completos, inclusive o público (Shounen, Seinen...) |
| MyAnimeList (pela API Jikan) | Descrição; gêneros, temas e o público |
| Kitsu | Descrição; categorias (Isekai, Magic, Dark Fantasy...) |

## A mesma obra em todas

Antes de juntar, o site escolhe a **mesma obra** em cada fonte: primeiro as que têm exatamente o nome pesquisado (por
qualquer um dos nomes que a fonte conhece); depois as que têm um nome em comum com uma já escolhida (o MangaUpdates
chama "Raising Villains the Right Way" de "The Patron of Villains", e o Kitsu conhece os dois nomes, então liga as
duas). Uma fonte que achou outra obra fica de fora, para não misturar tags erradas. Sem nenhuma com o nome exato, vale
a primeira do MangaDex (ou do AniList), como antes. As versões em novel (MangaUpdates, MyAnimeList) não contam.

## As tags

- Juntam as de todas as fontes que acharam a obra, **cada uma uma vez**; as que **mais fontes trazem vêm primeiro**;
  no máximo 12.
- O mesmo gênero com nomes diferentes vira um nome só: Shonen/Shounen, Sci Fi/Science Fiction → Sci-Fi, Yaoi →
  Boys' Love, Yuri → Girls' Love, Female Harem → Harem, School → School Life etc.
- Ficam de fora as tags de formato ou de publicação, que não dizem nada da história: Full Color, Long Strip, Webtoon,
  Manhwa, Adaptation, Award Winning, Male/Female Protagonist, POV etc.

## A descrição

Em português do MangaDex, se existir (e estiver mesmo em português); senão, a primeira em inglês na ordem AniList,
MangaUpdates, MyAnimeList, Kitsu, MangaDex, traduzida como no [doc 102](102-descricao-sempre-em-portugues.md). Do
MangaUpdates sai o "From Yen Press:" do começo, que só diz de onde o texto foi copiado. O aviso do formulário diz de
quais sites vieram as tags.

## Tempo

As cinco buscas correm juntas. O MangaDex e o AniList têm até 6 s; as fontes extras, até 4 s cada: uma fora do ar não
segura a resposta. Num teste, a busca toda levou de 4 a 6 s (com o MyAnimeList sem responder da máquina de teste).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_sinopse.js` | As buscas no MangaUpdates, MyAnimeList e Kitsu; todas ao mesmo tempo; `mesmaObra`, `juntarTags` e `nomeDaTag`; a resposta ganhou `fontes` |
| `public/app.js` | O aviso diz de quais sites vieram as tags |
| `test-api/sinopse.test.mjs` | A mesma obra em várias fontes (pelo nome e por nome em comum), a outra obra e a novel de fora, a ordem das tags, os nomes iguais, a descrição da fonte seguinte |

## Como foi testado

- Os 109 testes passam.
- Com a internet de verdade: Raising Villains the Right Way, Solo Leveling, Doomsday Wedding, The Eminence in Shadow
  e Omniscient Reader acharam a obra em 3 ou 4 fontes (o MyAnimeList não respondeu da máquina de teste; no Vercel ele
  deve responder). Raising Villains passou de 2 tags (Action, Fantasy) para 12: Action, Magic, Isekai, Drama, Fantasy,
  Comedy, Reincarnation, Monsters, Adventure, Yandere, Harem, Shounen.
- No navegador, o cadastro de Raising Villains the Right Way veio com a descrição em português e as 12 tags, e o aviso
  "Tags de MangaDex, AniList, MangaUpdates, Kitsu".
