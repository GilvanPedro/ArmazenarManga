# 132 · Kitsu quando o AniList cai

## O que aconteceu

O **Descobrir** da Biblioteca e as **recomendações** na página de um mangá ("Parecidos com este") pararam de mostrar
qualquer coisa. O defeito não era no Viracap: em 21/10/2026 o próprio AniList desligou a API dele, respondendo
"The AniList API has been temporarily disabled due to severe stability issues" (erro 403). Como as duas partes
dependiam só do AniList, ficaram vazias, sem aviso.

## A fonte reserva: Kitsu

Agora, quando o AniList não responde, o site busca no **Kitsu** (kitsu.app), outro catálogo grande de mangás com API
aberta, e mostra as obras do mesmo jeito: capa, nome, nota, ano, gêneros em português, "+ Adicionar" e o sorteio.

- **Quando passa para o Kitsu:** as buscas de lista do AniList (o Descobrir) e a lista de temas sempre respondem
  quando ele está no ar; se uma delas voltar sem resposta, o site usa o Kitsu e, nos 2 minutos seguintes, vai direto a
  ele, sem esperar o AniList de novo. As recomendações de um mangá também usam o Kitsu quando o AniList não trouxe nada
  (fora do ar, ou ele não conhece a obra nem as tags).
- **Volta sozinho:** passados os 2 minutos, o site tenta o AniList de novo. Quando ele voltar, tudo volta a vir dele.

### Como as regras do Descobrir ficam no Kitsu

| No Descobrir | No Kitsu |
|--------------|----------|
| Nome buscado | Busca por texto dele |
| Tags de "Quero" (precisa ter todas) | Categorias, também "precisa ter todas". Tags com outro nome lá são traduzidas (Murim e Wuxia → Martial Arts, Regression → Time Travel, Sci-Fi → Science Fiction…). As que ele não tem (ex.: Villainess, System) são ignoradas e avisadas, como já era |
| Tags de "Não quero" | O Kitsu não sabe excluir: as obras com uma delas saem depois de chegar (a página pode vir com menos de 20) |
| Mais populares / Em alta | Mais seguidores (o Kitsu não tem "em alta" com filtros) |
| Melhor avaliados | Nota média |
| Mais recentes | Data de início |
| Título (A–Z) | Título |
| Por página | 20 (o máximo do Kitsu; o AniList dá 24) |

Só entram quadrinhos (mangá, manhwa, manhua, one-shot): romances e doujins ficam de fora, e também obras para maiores
e com categorias adultas.

### Recomendações de um mangá pelo Kitsu

O Kitsu não tem "quem leu isto também leu". As parecidas são as obras populares com as categorias da própria obra
(sem as de público-alvo, como Shounen) e as das tags do mangá; quem divide mais categorias vem primeiro. A obra só é
reconhecida se um dos nomes dela bater com o título, porque a busca por nome do Kitsu é bem aproximada.

## No site

Os links das obras vindas do Kitsu abrem a página delas no Kitsu, e os textos dizem isso: "Ver no Kitsu" no sorteio e
"(abre o Kitsu)" para leitores de tela.

## Detalhe técnico

O Kitsu só responde a quem pede o formato dele (`Accept: application/vnd.api+json`); com `application/json` ele
recusa (406). A busca de sinopses ([doc 103](103-descricao-e-tags-de-varios-sites.md)) já mandava isso.

A versão Java antiga (`RecomendacaoService.java`) não ganhou o Kitsu: o site no ar usa só a API em JavaScript.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_kitsu.js` | Novo: as buscas no Kitsu, com as obras no formato das do AniList |
| `api/_recomendacoes.js` | Usa o Kitsu quando o AniList não responde; os cartões do Descobrir montados numa função só |
| `public/app.js` | "Ver no Kitsu" e "(abre o Kitsu)" para as obras de lá |
| `test-api/recomendacoes.test.mjs` | Testes do Descobrir e das recomendações pelo Kitsu |

> O Kitsu passou a entrar só com o AniList realmente fora do ar, também nas recomendações: veja [doc 134](134-descobrir-e-recomendacoes-mais-rapidos.md).
