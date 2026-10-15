# 29 · Comunidade centralizada

Ajuste visual feito em outubro de 2026 na página da Comunidade (veja [Comunidade](28-comunidade.md)).

## O que motivou

O feed e a caixa "Quem seguir" eram centralizados juntos, como um bloco só. Por isso o feed ficava deslocado para a
esquerda do meio da tela.

## O que mudou

- O **feed fica exatamente no meio da tela**, com o mesmo espaço dos dois lados (até 620 px de largura).
- **"Quem seguir"** ocupa o espaço da direita, sem empurrar o feed.
- Em telas de até **1180 px**, onde não cabe "Quem seguir" ao lado, ela some e o feed continua no meio. Antes isso
  acontecia só a partir de 1000 px.
- No celular, o feed ocupa a largura da tela, como antes.

Vale para o feed, para o perfil de cada leitor e para a página de um post sozinho, que usam o mesmo espaço.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Grade de três colunas (espaço, feed, espaço com "Quem seguir") e o corte em 1180 px |

## Testes

Conferido em um navegador, medindo o espaço dos dois lados do feed: iguais em 1920, 1366, 1200, 1100 e 768 px, e
16 px de cada lado no celular (375 px), sem rolagem para o lado. Não há teste automático.

> Depois, o feed ficou mais largo (até 860 px) e passou a ficar no meio da tela junto com o "Quem seguir": veja
> [Comunidade mais larga](41-comunidade-mais-larga.md).
