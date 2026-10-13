# 19 · Destaque roxo do favorito

Ajuste visual feito em outubro de 2026 no destaque criado em
[Favoritos e ordem pela nota](16-favoritos-e-ordem-pela-nota.md).

## O que motivou

A borda dourada do favorito era simples demais. O pedido foi uma borda roxa, mais bonita e que se destacasse
sem exagero, um brilho quase imperceptível na capa e um efeito ao passar o mouse.

## O que mudou

### Borda e brilho em volta

- A borda do favorito passou de dourado liso para um **degradê roxo** (lilás claro, violeta, roxo escuro e um
  toque de rosa), com 3 px.
- Em volta da capa há um **brilho roxo suave**, no lugar do brilho dourado.
- A **estrela** do canto superior direito ficou roxa, com a estrela branca e um contorno claro. Ela continua
  existindo para o destaque não depender só da cor.
- O botão "★ Favorito" da página do mangá acompanha o roxo.

### Reflexo na capa

Um reflexo claro atravessa a capa do favorito na diagonal a cada 7 segundos. Ele é propositalmente fraco (no
máximo 20% de branco) e passa a maior parte do tempo parado fora da capa.

### Efeito ao passar o mouse

- **Toda capa da lista** sobe 3 px e ganha uma sombra. O leve zoom da imagem, que já existia, continua.
- **Na capa do favorito**, além disso, o brilho roxo fica mais forte e o reflexo passa uma vez, mais rápido.

O efeito de subir vale para as capas que são links (lista, "Lançam hoje", tags em comum). A capa da página do
mangá tem a borda e o reflexo, mas não sobe.

### Movimento reduzido

Para quem ativou "reduzir movimento" no sistema, o reflexo não é animado e as capas não sobem. A borda, o
brilho em volta e a estrela continuam.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Borda em degradê, brilho, reflexo animado, estrela roxa e efeito de passar o mouse |

Só o estilo mudou. Não houve mudança no servidor nem no JavaScript do site.

## Testes

Conferido em um navegador, nos temas claro e escuro: borda, brilho e estrela; o efeito de passar o mouse em uma
capa comum e na do favorito; e a animação desligada com "reduzir movimento". Não há teste automático.
