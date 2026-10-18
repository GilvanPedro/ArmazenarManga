# 93 · A página do mangá no meio da tela

A página de informações de um mangá (capa, título, status, nota, tags, botões e descrição) ficava encostada na
esquerda, com muito espaço vazio à direita em telas largas. Agora:

- **Computador:** tudo fica num bloco de até 940 px no meio da tela (`.pagina-do-manga`), com a capa à esquerda e as
  informações ao lado, como antes. Os "parecidos" embaixo seguem o mesmo bloco.
- **Celular:** a capa (que fica em cima das informações) ficou no meio, em vez de colada na esquerda.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | A página do mangá ganhou a classe `pagina-do-manga` |
| `public/app.css` | O bloco de até 940 px no meio; a capa no meio no celular |

## Como foi testado

No navegador, num mangá com descrição e tags, a 1550 px (o bloco foi de 131–1419 para 305–1245, no meio) e a 390 px
(a capa no meio). O site compactado também foi conferido, e os 101 testes passam.
