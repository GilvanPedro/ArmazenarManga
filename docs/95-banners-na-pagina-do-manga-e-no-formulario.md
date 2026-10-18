# 95 · Banners na página do mangá e no formulário

Mais quatro lugares de banner, marcados pelo dono em capturas de tela, no mesmo esquema do
[doc 91](91-lugares-de-banner.md) (verticais nas laterais quando sobra espaço; sem espaço, horizontais):

| Página | Tela larga | Tela estreita (e celular) |
|--------|------------|---------------------------|
| Página do mangá | Verticais nas duas laterais (`manga-esquerda`, `manga-direita`) | Horizontal entre as informações e "Na sua lista, com tags em comum" (`manga-meio`) e outro no fim, embaixo dos recomendados (`manga-fim`) |
| Novo mangá e Edição geral | Verticais nas duas laterais (`formulario-esquerda`, `formulario-direita`) | Horizontal em cima, antes do "← Voltar" (`formulario-topo`), e outro embaixo do Cadastrar (`formulario-fim`) |

Os verticais ficam na altura do meio da tela, como os da Loja ([doc 92](92-banners-laterais-no-meio-da-tela.md)).
Os relatórios mostram os lugares com nome ("Página do mangá, lateral esquerda", "Novo mangá e edição, embaixo").

Também: montar a página do mangá em duas partes (para os trilhos acharem o conteúdo) fazia as partes vazias (o aviso
de leitura e o "sorteado", quando não aparecem) virarem o texto "null" ao lado de "← Todos os mangás". As partes vazias
agora saem antes.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | Os oito lugares novos em `LUGARES_DE_BANNER` |
| `public/app.js` | Os lugares na página do mangá e no formulário |

## Como foi testado

No navegador, com um banner horizontal e dois verticais no ar, nas larguras 1550, 880 e 390 px: a página do mangá, o
Novo mangá e a Edição geral mostraram os verticais nas laterais na tela larga e os horizontais nos lugares certos nas
outras. Os testes passam e o site compactado foi conferido.
