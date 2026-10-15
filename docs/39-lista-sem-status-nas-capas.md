# 39 · Lista publicada sem status nas capas

Ajuste feito em outubro de 2026 na janela da lista publicada (veja
[Lista publicada em janela](30-lista-publicada-em-janela.md) e
[Detalhe da lista sem status](35-detalhe-da-lista-sem-status.md)).

## O que mudou

Na grade da lista publicada, as capas dos mangás não mostram mais o selo de status de quem cadastrou (Lendo, Hiatus,
Concluído…). Fica só a nota, além da borda de favorito. Com isso, o status não aparece em nenhum lugar da lista: nem
na grade, nem no detalhe do mangá.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `capaDaLista` não desenha mais o status (o parâmetro virou `comNota`) |

## Testes

Conferido em um navegador: na grade da lista, cada capa só tem o selo da nota. Não há teste automático.
