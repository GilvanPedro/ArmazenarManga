# 133 · Título bagunçado ao marcar capítulo lido

## O defeito

Ao marcar um capítulo como lido pelo favorito ou pela extensão, alguns sites deixavam o nome do mangá assim:

> `: Manga The Sword Saint Reincarnated Into a Noble Mage Family Read`

Com o ":" no começo, o "Manga" e o "Read" em volta, o nome não batia com o do mangá cadastrado. O site não reconhecia
o mangá e oferecia cadastrá-lo de novo.

Dois motivos:

- a limpeza do título da página (`limparTitulo`) tirava o "Manga" do começo e o "Online" do fim só uma vez, e não
  tirava pontuação solta nas pontas nem um "Read" sobrando no fim;
- a busca do nome do mangá dentro do título só aceitava, logo depois do nome, o capítulo, um separador ou o fim. Um
  "Read" ou "Online" depois do nome fazia ela desistir.

## O que mudou

**Limpeza do título** (`limparTitulo`): depois dos passos de antes, repete até não mudar mais:

- tira pontuação solta nas pontas (`:`, `-`, `|`, `,` e afins). O ponto no começo fica, por nomes como ".hack//";
- tira etiquetas e "Read Manga", "Ler Mangá" do começo;
- tira "Online", "Free", "Raw", "PT-BR", "Read", "Ler", "Leia" e o tipo da obra (Manga, Manhwa…) do fim;
- tira um volume no começo ("Vol. 2:", "Volume 3 Chapter 12 -").

**Reconhecer o mangá da lista** (`mangaDoLink`):

- o nome inteiro do mangá dentro do título agora vale também quando vem seguido de "Read", "Ler", "Online", "Free"
  ou "Grátis";
- **novo:** o nome escrito no próprio endereço do capítulo, mesmo num site onde o mangá ainda não foi lido
  (".../the-sword-saint-reincarnated-into-a-noble-mage-family/chapter-12"). Vale quando um trecho do caminho, sem os
  códigos e as palavras de capítulo, é exatamente o nome de um mangá da lista (com pelo menos duas palavras), e só de
  um.

As regras de antes continuam: "Solo Leveling Ragnarok" não vira "Solo Leveling", e na dúvida entre dois mangás o site
não sugere nenhum.

## Testes

Essas funções ficam no `app.js` do site e não tinham testes. O novo `test-api/titulo-da-pagina.test.mjs` copia as
funções de lá e confere o caso relatado, variações dele (com "Chapter 12:", "Vol. 2:", "Read Online Free") e dez
títulos que já eram limpos certo antes, para garantir que continuam iguais.

## Mangás cadastrados de novo por causa disso

Se algum mangá acabou cadastrado duas vezes (um com o nome bagunçado), o certo é apagar o repetido e marcar o
capítulo de novo no original.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `limparTitulo` mais completa, `nomesNoEndereco` (nova) e `mangaDoLink` com o nome no endereço |
| `test-api/titulo-da-pagina.test.mjs` | Novo: os testes da limpeza do título e do reconhecimento |
