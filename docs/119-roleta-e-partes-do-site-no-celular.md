# 119 · Botões da roleta e as partes do site no celular

Dois ajustes para o celular.

## As partes do site (Biblioteca, Comunidade, Loja) mais fáceis de achar

No celular, Biblioteca, Comunidade e Loja ficavam numa linha embaixo do logo como palavras soltas: só a parte aberta
tinha um fundo, e as outras quase não pareciam botões. Agora, em telas de até 900 px:

- elas viram uma **barra de botões do mesmo tamanho**, numa caixa com borda, cada um com um **ícone** em cima do nome
  (livros, balão de conversa, sacola e escudo para o Gerenciar);
- a parte aberta fica **cheia na cor de destaque do tema** (laranja no padrão, vermelho no Palácio Zen, prata na Lâmina
  Sombria…), com uma sombra leve;
- com as quatro partes (quem é administrador tem o Gerenciar), as letras ficam um pouco menores para "Comunidade" caber
  inteira, até em telas de 360 px.

No computador continua igual: os nomes ao lado do logo, sem ícone.

## Os botões da roleta

Na roleta ([doc 115](115-roleta-da-loja.md)), os botões quebravam de linha de qualquer jeito no celular ("Girar" e
"Girar 2 de uma vez" numa linha e o "Girar 3" sozinho; "Comprar giros:" dividindo a linha com um botão). Agora ficam em
blocos, com até 460 px de largura (a tela toda no celular):

- **"Você tem N giros"** em cima de três botões do mesmo tamanho: **Girar 1 giro**, **Girar 2 de uma vez** e **Girar 3
  de uma vez** (os que passam do que a pessoa tem ficam desligados);
- **"Comprar giros"** em cima de três botões do mesmo tamanho, com a quantidade e o preço em duas linhas (**1 giro ·
  R$ 5,00**, **2 giros · R$ 10,00**, **3 giros · R$ 15,00**);
- o **🎁 Girar de graça** ocupa a largura do bloco.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | O ícone e o nome (num `<span>`) de cada parte do site |
| `public/app.js` | Os botões da roleta em blocos (`bloco`, `botoesDeGirar`) |
| `public/app.css` | A barra das partes no celular, os ícones só no celular, o `hidden` das partes, e os blocos e a grade dos botões da roleta |

## Como foi testado

No celular simulado (390 e 360 px): a barra das partes com três (sem conta e conta comum) e quatro partes (o dono),
nos temas claro, escuro, Palácio Zen e Lâmina Sombria, com a parte aberta cheia na cor do tema e os nomes inteiros; no
computador, o topo igual ao de antes. A roleta nos três estados (giro grátis, com giros guardados e sem giros), com os
botões alinhados três a três. Os testes passam.
