# 128 · Os banners trocam junto com a página

Cada lugar de banner era sorteado uma vez só, quando aparecia na tela. Nas listas com páginas, trocar de página só
redesenhava a lista, e os banners continuavam os mesmos.

Agora, **a cada troca de página, todos os banners da tela são sorteados de novo**, pelo peso, entre os que estão no ar:

- pode sair outro banner ou o mesmo;
- dois lugares da mesma tela continuam sem repetir o mesmo banner, quando há outro para mostrar;
- cada sorteio conta uma **exibição nova** no relatório, porque o leitor viu o banner de novo numa página nova;
- o banner antigo fica até o novo entrar, então a tela não pula.

## Onde vale

| Lista | Como ficou |
|-------|------------|
| Biblioteca (Todos os mangás) | Troca ao mudar de página (agora) |
| Lançam hoje | Troca ao mudar de página (agora; usa a mesma grade da Biblioteca) |
| Descobrir | Troca ao mudar de página (agora) |
| Loja | Já trocava: cada página da Loja tem endereço próprio e monta a tela de novo |

O feed da Comunidade não tem páginas: ele carrega mais posts embaixo, sem trocar de página, e os banners ficam os
mesmos.

Por dentro: `trocarBanners()` tira a marca de "pronto" de todos os lugares de banner da tela, e o mesmo
`arrumarBanners` de sempre sorteia de novo ([doc 76](76-banners-de-anuncio.md)).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `trocarBanners`, chamada nas páginas da Biblioteca e do Descobrir |
