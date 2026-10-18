# 101 · Obra nova com o começo do nome de uma da lista

Ao marcar um capítulo como lido (pelo favorito "Marcar capítulo lido" ou pela extensão), o site tenta reconhecer de
qual mangá da lista é a página. Dois problemas, relatados pelo dono:

1. **Uma obra nova cujo nome começa com o de uma da lista era tomada por ela.** Por exemplo, com "Solo Leveling" na
   lista, um capítulo de "Solo Leveling: Ragnarok" abria "Marcar capítulo lido" de Solo Leveling, em vez do cadastro.
2. **Nessa tela não havia um jeito claro de cadastrar a obra como nova**: só um link pequeno no texto de ajuda e uma
   sugestão que aparecia ao apagar o nome e digitar outro.

## O que mudou

Em `mangaDoLink`, que compara a página com a lista:

- **Pelo endereço:** dois trechos do endereço só contam como "quase iguais" quando o que sobra depois do começo igual
  é um **código** (letras e números, com algum número, sem hífen), como em `the-novels-extra-3ec3b16f` e
  `the-novels-extra-bd5bdaf8` (o site trocou o id). `solo-leveling-ragnarok` **não** é quase igual a `solo-leveling`. A
  regra antiga dos 70% saiu: ela deixava passar o caso do Ragnarok e barrava o do id trocado.
- **Pelo nome dentro do título da página:** o nome de um mangá da lista só conta se o que vem logo depois dele é o
  capítulo ("Cap. 3", "Capítulo 12", "Chapter 3", "Ep 4", "#5", um número), um separador (`-`, `–`, `|`, `•`, `(`,
  `[`) ou o fim do título. "Solo Leveling Ragnarok" e "Solo Leveling: Ragnarok" não são "Solo Leveling"; "[Manga]
  Solo Leveling - Capítulo 12 - Leitor" continua sendo.

Assim, uma obra nova vai direto para o cadastro, já preenchido com o que a página informou.

Na tela **Marcar capítulo lido**, entrou o botão **"+ Cadastrar como mangá novo"**, ao lado de Cancelar e Salvar:
quando o site reconhece errado, um clique abre o cadastro preenchido com o endereço, o título e o capítulo da página.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | As duas regras de `mangaDoLink` e o botão "+ Cadastrar como mangá novo" |

## Como foi testado

No navegador, com a função do site e uma lista de três mangás, 9 casos: a mesma obra pelo link; obra nova que começa
com o nome (pelo link, com dois pontos, com o nome do site no título): nenhuma reconhecida; a mesma obra só pelo
título (com o site em volta, "Cap. 3", "Chapter 3"); o id do fim do link trocado: reconhecida; outra obra do mesmo site
com o começo igual: não reconhecida. Pela tela: a obra nova abriu o cadastro; uma página reconhecida mostrou o botão,
que abriu o cadastro preenchido. Os testes passam.
