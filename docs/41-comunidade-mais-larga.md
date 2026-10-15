# 41 · Comunidade mais larga, abas sem barra de rolagem e "Lista" sem emoji

Ajustes feitos em outubro de 2026 na aba Comunidade (veja [Comunidade centralizada](29-comunidade-centralizada.md)).

## O que mudou

- **Feed mais largo.** O feed ficava numa coluna de 620 px exatamente no meio da tela, com muito espaço vazio dos lados.
  Agora ele vai até **860 px**, e o feed e o "Quem seguir" (300 px, à direita) ficam juntos no meio da tela. Em telas
  com até 1100 px, o "Quem seguir" some e o feed ocupa a largura disponível, como antes.
- **Abas sem barra de rolagem.** Ao lado de "Para você" e "Seguindo" aparecia uma barra de rolagem. O sublinhado da
  aba ativa descia 1 px além da linha das abas, e por isso a linha ficava 1 px mais alta do que o espaço dela. Agora a
  linha embaixo das abas é desenhada por dentro (uma sombra no lugar da borda), sem sobrar nada. A barra de rolagem das
  abas também ficou escondida (dá para rolar para o lado no celular, se elas não couberem). Vale para todas as linhas
  de abas do site, incluindo as da Biblioteca.
- **"Lista" sem emoji.** No cartão da lista dentro do post, o rótulo "📚 Lista" virou só "Lista". O mesmo vale para o
  resumo da lista anexada na janela de escrever um post. O botão "📚 Lista" da barra de ferramentas da janela de
  escrever continua com o ícone, como o "🖼 Imagem".

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.pagina-da-comunidade` com o feed de até 860 px ao lado do "Quem seguir"; `.abas` com a linha por dentro e sem barra de rolagem; `.aba` sem a margem de -1 px |
| `public/app.js` | `listaDoPost` e o anexo da janela de escrever sem o 📚 |

## Testes

Conferido em um navegador, em 1920, 1366 e 390 px: o feed com 860 px (358 px no celular), as abas sem rolagem e a
página sem rolagem para o lado. Não há teste automático.

> Depois, o feed voltou a ficar exatamente no meio da tela, com o "Quem seguir" no espaço da direita: veja
> [Feed da Comunidade no meio da tela](43-feed-no-meio-da-tela.md).
