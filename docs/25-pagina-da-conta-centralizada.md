# 25 · Página da conta centralizada

Ajuste visual feito em outubro de 2026 na página **Minha conta** (veja [Contas de usuário](23-contas.md) e
[Foto de perfil](24-foto-de-perfil.md)).

## O que motivou

A página ficava encostada no canto esquerdo da tela, com o espaço da direita vazio.

## O que mudou

- As partes da página (foto de perfil, nick, e-mail, senha, mangás antigos e excluir conta) ficam numa **coluna
  no meio da tela**, com a mesma largura de antes (até 640 px).
- O cabeçalho fica **centralizado**: a foto (ou a inicial), maior que antes (88 px), com o nick e, embaixo, o
  e-mail, a quantidade de mangás e a data de criação.
- O link "← Todos os mangás" continua no começo da coluna.
- Dentro de cada parte, os textos e campos continuam alinhados à esquerda, como nos outros formulários do site.
- No celular, a coluna ocupa a largura da tela, como antes.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Coluna centralizada e cabeçalho da conta centralizado |

## Testes

Conferido em um navegador, no computador (1280 px, coluna com o mesmo espaço dos dois lados) e no celular
(375 px, sem rolagem para o lado). Não há teste automático.

> Depois, na versão do Vercel, a página "Minha conta" virou "Configurações" e a foto e o nick passaram a ser
> editados no próprio perfil: veja [Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md).
