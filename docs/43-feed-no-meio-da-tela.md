# 43 · Feed da Comunidade no meio da tela

Ajuste feito em outubro de 2026 na aba Comunidade (veja [Comunidade mais larga](41-comunidade-mais-larga.md)).

## O que mudou

Desde que o feed ficou mais largo, o que ficava centralizado era o conjunto feed + "Quem seguir". Assim, o feed ficava
à esquerda do meio da tela, mais ainda em notebooks (em 1536 px, o meio do feed ficava uns 160 px à esquerda). Agora:

- **O feed fica exatamente no meio da tela**, na Comunidade, no post aberto e no perfil. O "Quem seguir" ocupa o espaço
  da direita, e o da esquerda fica vazio, do mesmo tamanho.
- **O feed vai até 860 px** e encolhe quando não há espaço para ele e as duas laterais (cada uma com pelo menos 260 px).
  O "Quem seguir" tem de 260 a 300 px.
- **A Comunidade usa a largura toda da tela.** O resto do site continua limitado a 1320 px (1680 px em monitores de
  1800 px ou mais). Sem esse limite, o feed chega a 758 px em 1366 px, a 832 px em 1440 px e a 860 px a partir de
  1536 px.
- Até 1180 px, como antes, o "Quem seguir" some e o feed (até 860 px) fica sozinho no meio.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.pagina-da-comunidade` com três colunas (lateral vazia, feed, "Quem seguir"); `main:has(> .pagina-da-comunidade)` sem o limite de largura |

## Testes

Medido em um navegador, em 1024, 1180, 1200, 1280, 1366, 1440, 1536, 1920 e 2560 px, no feed, no post aberto e no
perfil: o meio do feed fica a 0 px do meio da tela em todos, sem rolagem para o lado. Não há teste automático.
