# 30 · Lista publicada em janela

Ajuste feito em outubro de 2026 na lista de mangás anexada aos posts da Comunidade (veja [Comunidade](28-comunidade.md)).

## O que motivou

O post mostrava todas as capas da lista numa fileira que rolava para o lado, o que ocupava muito espaço no feed. O
pedido foi deixar no post só uma miniatura e abrir a lista inteira ao clicar, com o que o autor tinha cadastrado de
cada mangá.

## O que mudou

### No post

A lista aparece como um cartão: a **capa do primeiro mangá**, com as seguintes sugeridas como cartas empilhadas atrás
(quando há mais de um), o título da lista, quantos mangás são, os três primeiros nomes e "Ver lista →". O cartão
inteiro é clicável.

### A janela da lista

Clicar abre uma janela com o título da lista, de quem ela é e **todos os mangás** em grade, cada um com a capa, o
status, a nota e a borda de favorito.

### O mangá dentro da lista

Clicar num mangá mostra, na mesma janela, **o que o autor tinha cadastrado** quando publicou a lista:

- capa, status, **nota** (ou "Sem nota") e o selo **Favorito**;
- **último capítulo lido**;
- **tags**;
- **descrição** (ou "Sem descrição").

É só para ver: não há link para ler, nem botões de editar ou marcar capítulo. Uma linha avisa que aquilo é "como
estava na Biblioteca de {nick} quando a lista foi publicada". "← Voltar para a lista" volta à grade, e Esc ou o ×
fecham a janela.

## O que mudou no servidor

A cópia de cada mangá guardada no post passou a levar também as **tags** (até 20) e a **descrição** (até 2000
caracteres), além do título, capa, status, nota, favorito e capítulo. Listas publicadas antes disso não têm esses
dois campos: o mangá aparece com "Sem descrição" e sem tags.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade_rotas.js` | Tags e descrição na cópia de cada mangá da lista |
| `public/app.js` | Cartão da lista no post, janela da lista e o mangá dentro dela |
| `public/app.css` | Capas empilhadas, janela da lista e o mangá em detalhe |

## Testes

Conferido em um navegador: o post com uma capa só e o resumo da lista; a janela com os quatro mangás; o mangá
favorito com nota, capítulo, tags e descrição, sem nenhum link; um mangá sem nota e sem descrição; fechar com Esc; e o
celular, sem rolagem para o lado. Os 61 testes da versão JavaScript continuam passando.
