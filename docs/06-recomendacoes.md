# 06 · Recomendações

Tudo o que o sistema busca na internet para sugerir ou preencher. São três serviços públicos e gratuitos:

| Serviço | Para que é usado |
|---------|------------------|
| **AniList** | Recomendações, busca geral, gêneros e nomes das obras |
| **MangaDex** | Descrições em português e nomes em várias línguas |
| **MyMemory** | Tradução automática entre português e inglês |

Se um deles falhar, o resultado é "não encontrei" e o resto do site segue funcionando.

## Descrição automática

Ao cadastrar uma obra pelo "marcar como lido", por uma recomendação ou pelo botão "Buscar na internet":

1. Procura no MangaDex uma descrição em português.
2. Se não houver, pega a descrição em inglês do AniList (ou do MangaDex) e traduz pelo MyMemory.
3. Se a tradução falhar, devolve em inglês, avisando.

O texto é limpo (sem HTML, marcações e avisos da fonte) e limitado a 1500 caracteres. Embaixo do campo aparece de
qual obra e de qual fonte veio, para conferir. Os gêneros da obra, em inglês, são sugeridos como tags.

## Semelhantes da própria lista

Na página de um mangá, a seção "Na sua lista, com tags em comum" mostra até 6 mangás que dividem tags com ele,
começando pelos que dividem mais. Não usa a internet.

## Recomendações de fora

A seção "Parecidos com este, para ler depois" busca até 6 obras que não estão na lista, combinando três fontes,
nesta ordem:

1. **O que os leitores recomendam** para aquela obra no AniList.
2. **Obras dos mesmos gêneros e temas** da obra, se as recomendações forem poucas.
3. **Obras com as tags do mangá**, que completam o resultado ou assumem quando o AniList não conhece o título.

O título é procurado como está e em versões mais curtas, sem o que vem entre parênteses e sem subtítulo.

## Aba Descobrir

Busca geral no AniList, fora da lista:

- por **nome**;
- por **tags que quero** (a obra precisa ter todas as marcadas);
- sem as **tags que não quero** (a obra não pode ter nenhuma; "Harem" tira os dois tipos de harém de uma vez);
- em seis **ordens**: mais relevantes, mais populares, melhor avaliados, em alta, mais recentes e título.

### Tags e o AniList

As tags do dono precisam ser convertidas para o que o AniList entende:

- Tags que são **gêneros** do AniList (Action, Fantasy…) viram filtro de gênero.
- Algumas têm **outro nome** lá: Murim → Wuxia, Regression → Time Manipulation, School Life → School.
- Algumas são **gerais demais**: "Harem" corresponde a "Female Harem" ou "Male Harem". O sistema faz uma busca
  para cada forma e junta os resultados, reordenando pela ordem pedida.
- Tags que o AniList **não tem** são ignoradas, e a página avisa quais foram.

## Não repetir o que já está na lista

O problema: um mangá cadastrado como "Ponto de Vista do Leitor Onisciente" é a mesma obra que o AniList chama
de "Omniscient Reader". Comparar só pelo título deixaria a obra aparecer como recomendação.

### Descobrir os outros nomes

Para cada mangá da lista, o sistema busca e guarda os outros nomes da obra, em três tentativas:

1. **AniList**, com vários títulos no mesmo pedido: nome em inglês, original, nativo e apelidos, mais a
   identificação da obra.
2. **MangaDex**, para os que o AniList não conhece. A busca dele é aproximada, então só vale a obra que tem
   exatamente o nome procurado entre os dela.
3. **Tradução**: o título é traduzido do português para o inglês e procurado de novo no AniList.

São consultados 20 mangás por vez, cada vez que uma página com recomendações é aberta. O resultado fica guardado
junto do mangá, então cada título é consultado uma vez só. Um título que não deu para consultar (serviço fora do
ar) não é marcado como "não existe" e será tentado de novo.

### Comparar

Uma sugestão é escondida se for a mesma obra no AniList ou se algum nome dela bater com algum nome de um mangá
da lista. Entram na comparação o título, os outros nomes guardados e o nome que aparece no link de leitura
(`.../omniscient-readers-viewpoint-3ec3b16f/...`).

Cada nome é comparado em várias formas: sem acentos e sinais, sem espaços, sem o artigo do começo ("The", "O") e
como conjunto de palavras sem as de ligação ("de", "do", "of"). Continuações não se confundem: ter "Solo Leveling"
na lista não esconde "Solo Leveling: Ragnarok".

### Limite

Ainda pode escapar um título que nenhuma fonte reconhece, que a tradução não acerta e cujo link não traz o nome
da obra.

## Cuidados com os serviços

- Cada chamada se identifica com o nome do projeto, como esses serviços pedem.
- As recomendações de uma obra ficam guardadas em memória por 12 horas, e a lista de temas do AniList por um dia.
- O AniList limita a cerca de 30 pedidos por minuto. Por isso os títulos da lista são consultados em lotes.
- A cota gratuita de tradução é diária. Quando acaba, as descrições vêm em inglês.
