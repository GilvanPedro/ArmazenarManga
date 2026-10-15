# 31 · Montar a lista pela Biblioteca

Mudança feita em outubro de 2026 na janela de montar a lista que vai anexada a um post da Comunidade (veja
[Comunidade](28-comunidade.md) e [Lista publicada em janela](30-lista-publicada-em-janela.md)).

## O que motivou

A janela antiga mostrava os mangás numa lista de linhas, com uma busca simples. O pedido foi uma versão simplificada
da Biblioteca: as capas, com busca, filtro e ordem, e a ordem da lista visível em cada capa escolhida.

## Como ficou

A janela **"Montar lista"** (botão "Lista" no campo de escrever) mostra:

- o **título da lista** (opcional);
- a **busca pelo nome**, as **ordens** da Biblioteca (cadastro, título, capítulos, notas, favoritos…) e os
  **filtros de status**;
- a **grade de capas** da Biblioteca, cada uma com o **nome**, a **nota** e a **borda de favorito**.

Para escolher:

- **Clicar numa capa** põe o mangá na lista: a capa **escurece, mas continua visível**, e o **número da posição**
  dele na lista aparece **no meio da capa, numa bola** laranja com borda branca. O nome fica laranja.
- **Clicar de novo** tira o mangá, e os números dos outros se reorganizam.
- Os escolhidos continuam marcados ao buscar, filtrar ou trocar a ordem.
- Até **20** mangás; com 20, as outras capas ficam apagadas até um sair.
- O rodapé mostra quantos estão na lista ("3 de 20 na lista"), o botão **Limpar** e **Anexar lista**.

A lista é publicada **na ordem em que os mangás foram escolhidos**.

Os mangás vêm do servidor aos poucos, 48 por vez, conforme a grade rola, já buscados, filtrados e ordenados. Assim a
janela funciona igual numa Biblioteca pequena e numa com milhares de mangás. As capas usam a miniatura, quando há.

No celular, a janela ocupa quase a tela toda e a grade mostra três capas por linha.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `escolherLista` refeita: grade de capas, busca, status, ordem, posição na capa e carregamento aos poucos |
| `public/app.css` | Estilo da janela, da grade, da capa escolhida e da bola com a posição |

Não houve mudança no servidor: a janela usa a mesma lista de mangás da Biblioteca (`GET /api/mangas?resumo=1&…`).

## Testes

Conferido em um navegador com 60 mangás na Biblioteca: 48 capas na primeira leva e as 60 ao rolar; bordas de
favorito e notas; três escolhidos com as posições 1, 2 e 3 na ordem dos cliques; tirar um e ver os números se
reorganizarem; busca, filtro de status e ordem por melhores notas, com os escolhidos ainda marcados; a lista publicada
na ordem escolhida; e o celular, sem rolagem para o lado. Não há teste automático.
