# 42 · Responsividade em celulares, tablets e monitores

Revisão feita em outubro de 2026 em todo o site, para funcionar bem em celulares de vários tamanhos, tablets (em pé e
deitados) e monitores, dos pequenos aos muito grandes.

## Como foi analisado

Um script abriu cada tela e cada janela do site (login, Biblioteca, painel de Tags, janela do capítulo, Lançam hoje,
Descobrir, Extensão e atalho, página do mangá, cadastro e edição, Minha conta, Comunidade, post aberto, perfil, janela
de escrever, montar lista, lista publicada e o mangá dentro dela, imagem grande e confirmação). Isso foi feito em 14
tamanhos de tela:

| Tipo | Tamanhos (largura × altura) |
|------|-----------------------------|
| Celular | 320×568, 360×740, 390×844, 430×932 |
| Celular deitado | 844×390 |
| Tablet | 600×960, 768×1024, 820×1180, 1024×768, 1024×1366 |
| Notebook e monitor | 1280×800, 1440×900, 1920×1080, 2560×1440 |

Em cada um, ele mediu se a página rola para o lado, o que passa da borda da tela, texto que vaza da caixa, botões
pequenos demais para o dedo (em telas de toque) e campos com letra menor que 16 px (o iPhone dá zoom ao tocar neles).
Também tirou uma captura de cada tela, que foi conferida a olho. A conta de teste tinha títulos e nicks longos, muitas
tags, descrições grandes, posts com links enormes, imagens largas e altas e uma lista com 12 mangás.

## O que foi corrigido

- **Topo no tablet.** Em 768 px, o logo, as partes do site, "Adicionar", o nick e "Sair" tentavam caber numa linha, o
  nome quebrava e o "Sair" saía da tela. Agora, até 900 px, Biblioteca e Comunidade descem para uma linha própria
  (antes isso só acontecia até 720 px).
- **Painel de Tags no tablet.** Em 600 px o painel saía pela esquerda. Agora, até 900 px, ele ocupa a largura da barra
  de ferramentas (antes, só até 560 px).
- **Barra da Biblioteca no celular.** A busca, Tags, a ordem e Sortear ficavam um em cada linha, e depois a ordem ficou
  espremida por um espaçador invisível. Agora a busca ocupa a linha toda, e Tags, a ordem e Sortear dividem a de baixo
  (em 320 px o Sortear desce para a linha seguinte).
- **Abas que não cabem.** No celular, "Descobrir" ficava cortado e "Extensão e atalho" escondido, sem nenhum sinal de
  que dava para rolar. Agora a borda da linha de abas esmaece do lado onde há mais abas, e a aba aberta aparece na tela
  ao entrar. As abas também ficaram um pouco mais juntas.
- **Janelas no celular.** As janelas ocupam quase toda a largura (8 px de cada lado) e têm menos margem por dentro. A
  lista publicada mostra duas capas por linha em 320 px (antes, uma só e enorme). As confirmações usam a largura toda.
- **Montar a lista no celular.** O rodapé ("Clique nas capas…" e o botão) quebrava o texto palavra por palavra em
  320 px. Agora o texto fica numa linha e o botão embaixo.
- **Montar a lista em telas baixas (celular deitado).** As capas ficavam espremidas numa faixa de uns 40 px. Agora, em
  telas com até 560 px de altura, a janela inteira rola e o rodapé com o botão fica preso embaixo. Mais capas continuam
  chegando ao rolar, nos dois jeitos: a próxima página é pedida quando o fim da grade chega perto da borda de baixo do
  que está aparecendo, seja a grade que rola ou a janela inteira.
- **Zoom no iPhone.** Todos os campos tinham letra menor que 16 px, e o iPhone aumenta a página ao tocar num campo
  assim. Em telas de toque, campos, seletores e caixas de texto passam a usar 16 px.
- **Botões pequenos para o dedo.** Em telas de toque, ganharam área maior: curtir, comentar e apagar do post, o × das
  janelas, o × de apagar comentário, o × de tirar uma tag no cadastro, "← Voltar", "← Voltar para a lista",
  "Mostrar tags", as tags da página do mangá e "Criar uma conta" no login.
- **Monitores grandes.** Em telas com 1800 px ou mais, o conteúdo vai até 1680 px (antes, 1320 px), e a Biblioteca
  mostra até 8 colunas de capas (antes, 6).

O que a análise apontou e ficou como está:

- A pilha de capas do cartão da lista no post: as capas de trás passam um pouco da caixa de propósito, giradas.
- O nick e a hora no cabeçalho do post, e o logo no topo: são links de texto, do tamanho da letra, como em qualquer
  site.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Topo em duas linhas até 900 px; painel de Tags preso à barra até 900 px; nova seção "responsividade" (monitores grandes, esmaecido das abas, celular, telas baixas, toque); × da tag com área maior |
| `public/app.js` | `rolagemDasAbas` (esmaecido e aba aberta na tela) nas abas da Biblioteca; a janela de montar a lista pede a próxima página pela posição do fim da grade, com a grade ou a janela rolando |

## Testes

- A varredura nos 14 tamanhos, antes e depois: no fim, nenhuma tela rola para o lado e nada passa da borda (fora a
  pilha de capas). Também não sobrou campo com letra menor que 16 px nem botão pequeno em tela de toque (fora os links
  de texto citados acima).
- A janela de montar a lista com 60 mangás em 1366×800, 844×390 e 390×844: rolar até o fim carrega da 48ª capa até a
  60ª, escolher uma capa funciona e o rodapé continua na tela.
- `npm test` (61 testes) e os testes da versão Java passando. Não há teste automático de layout.
