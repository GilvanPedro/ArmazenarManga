# 35 · Detalhe da lista sem status e fechar volta à lista

Ajuste feito em outubro de 2026 na janela da lista publicada (veja
[Lista publicada em janela](30-lista-publicada-em-janela.md)).

## O que mudou

- **Sem o status no detalhe do mangá.** Ao abrir um mangá dentro da lista, o selo de status de quem cadastrou (Lendo,
  Hiatus, Concluído…) não aparece mais. Continuam a nota (ou "Sem nota"), o selo de favorito, o último capítulo lido, as
  tags e a descrição. Na grade da lista, as capas continuaram como antes (depois o status saiu delas também: veja
  [Lista publicada sem status nas capas](39-lista-sem-status-nas-capas.md)).
- **Fechar o detalhe volta à lista.** Com um mangá aberto, o **×** e o **Esc** voltam para a grade da lista, em vez de
  fechar a janela e voltar à Comunidade. Com a grade aberta, o × e o Esc fecham a janela, como antes. "← Voltar para a
  lista" continua funcionando.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `abrirListaDoPost`: sem o status no detalhe; × e Esc voltam à lista quando um mangá está aberto |

## Testes

Conferido em um navegador: o detalhe sem o selo de status (com nota, capítulo, tags e descrição); × no detalhe volta à
lista com a janela aberta; Esc no detalhe faz o mesmo; × na grade fecha a janela, continuando na página do post. Não
há teste automático.
