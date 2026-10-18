# 91 · Os lugares de banner no site

Os banners cadastrados em **Gerenciar → Banners** ([doc 76](76-banners-de-anuncio.md)) passaram a aparecer no site,
nos lugares que o dono marcou em capturas de tela (computador e janela estreita). Sem nenhum banner no ar de um
formato, aparece o banner padrão **"Anuncie aqui"**, que abre o e-mail do dono para quem quer anunciar.

## Onde aparecem

| Página | Tela larga | Tela estreita (e celular) |
|--------|------------|---------------------------|
| Biblioteca (Todos os mangás) | Horizontal embaixo da lista | O mesmo |
| Lançam hoje | Horizontal embaixo da lista | O mesmo |
| Descobrir | Verticais nas duas laterais | Horizontal em cima das obras |
| Extensão e atalho | Dois verticais na coluna ao lado do texto | Horizontal embaixo do texto (abaixo de 861 px) |
| Loja (todas as abas) | Verticais nas duas laterais | Horizontais em cima (antes das abas) e embaixo |
| Comunidade | Vertical na coluna da esquerda e outro embaixo de "Quem seguir" | Horizontal em cima do feed (abaixo de 1181 px) |

**As laterais (Descobrir e Loja)** são trilhos fixos na tela ao lado do conteúdo. O site mede o espaço que sobra do
lado mais estreito (menos 14 px do conteúdo e 14 px da beira): de 90 a 200 px, o vertical aparece com essa largura;
com menos de 90 px, os trilhos somem e entram os horizontais. Isso é refeito quando a janela muda de tamanho.

Cada lugar tem um nome (`loja-esquerda`, `comunidade-topo`, `biblioteca-fim`…), e os relatórios mostram as
exibições e os cliques por lugar com um nome legível ("Loja, lateral esquerda").

## Como cada lugar escolhe o banner

1. A página busca **`GET /api/banners/no-ar`** (sem login; a CDN guarda 1 minuto, a página guarda 2 minutos): os
   banners que podem aparecer agora, ou seja, não pausados, com peso maior que 0 e antes do dia do término.
2. Cada lugar sorteia um banner **do formato dele**, pelo **peso** (peso 3 aparece 3 vezes mais que peso 1), evitando
   repetir na mesma página o banner que já está em outro lugar (quando há outro).
3. Só os lugares que estão aparecendo na tela (não escondidos pelo tamanho da janela) são preenchidos e contam.
4. A imagem vem do banco (`/api/banners/{id}/imagem`), a mesma enviada no cadastro.

**Exibições:** cada lugar preenchido conta uma exibição, enviada em lote (`POST /api/banners/exibicoes`, até 12 de
uma vez), somada por dia, banner e lugar em `metricas_de_banner`. Só lugares conhecidos e banners no ar contam.

**Cliques:** o banner com link aponta para `/api/banners/{id}/clique?posicao=...`, que soma o clique e leva ao site da
empresa (em outra aba, com `rel="sponsored"`). Banner sem link aparece sem clique.

Sem rastrear ninguém: nada guarda conta, IP ou aparelho, como antes. Por ser uma contagem aberta, alguém mal
intencionado poderia inflar as exibições chamando a rota de propósito; os números servem para os relatórios, não
para cobrança automática.

## O banner padrão "Anuncie aqui"

Quando não há banner no ar daquele formato, o lugar mostra um convite em vez de ficar vazio: "📣 Anuncie aqui · Seu
banner para quem lê mangá, manhwa e webtoon todo dia · Fale comigo". Clicar abre o programa de e-mail com uma
mensagem para o dono do site, com o assunto "Anúncio no Viracap". Ele usa as cores do tema da pessoa. O banner
padrão não conta exibições.

O e-mail fica no código montado em duas partes, para não aparecer inteiro para robôs que procuram e-mails.

## Tamanhos

- Horizontal: até 970 px de largura e no máximo 200 px de altura (a imagem inteira, sem cortar).
- Vertical: a largura do lugar (90 a 200 px nas laterais, 180 px no atalho, até 200 px na Comunidade) e a altura que a
  imagem pedir, no máximo a altura da tela.
- Cada banner leva um selo "Anúncio" no canto. Na impressão, os banners somem.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | `LUGARES_DE_BANNER`, `lerExibicoes`, as rotas `no-ar`, `exibicoes` e `clique`, e o nome do lugar nos relatórios |
| `public/app.js` | Os lugares em cada página, o sorteio, a contagem, os trilhos e o banner padrão; o texto da aba Banners |
| `public/app.css` | Os lugares, os trilhos, o banner padrão e as regras de tela larga e estreita |
| `test-api/banners.test.mjs` | As exibições conferidas e o nome do lugar no relatório |

## Como foi testado

- Os 101 testes da versão JavaScript passam.
- Num banco local, com três banners cadastrados pela rota do Gerenciar (um horizontal 1280 × 400 com link, um vertical
  400 × 1280 com link e um vertical 160 × 600 sem link): eles foram guardados no banco com as imagens e apareceram em
  todos os lugares, nas três larguras (1550 px, 880 px e 390 px), cada página com os lugares certos para a largura. As
  exibições foram contadas por lugar, e o clique contou e levou ao link (302).
- Com os banners pausados, o "Anuncie aqui" apareceu em todos os lugares, também no celular. O site compactado também
  foi conferido.

> Depois, os banners das laterais passaram para a altura do meio da tela: veja [Banners laterais no meio da tela](92-banners-laterais-no-meio-da-tela.md).
