# 47 · Botões de seguir sincronizados

Correção feita em outubro de 2026 na Comunidade (veja [Comunidade](28-comunidade.md)).

## O problema

Parecia que seguir alguém não era salvo. Na verdade era: os testes mostraram que o banco grava quem você segue
(pelo post, pelo "Quem seguir" e pelo perfil), o perfil conta certo, o feed "Seguindo" traz os posts dessas pessoas e
o "Para você" dá a elas o peso de quem você segue. Isso foi conferido no computador e também no site publicado (com a
conta de teste, seguindo e desfazendo em seguida).

O que enganava era a tela. Cada botão "Seguir" era independente:

- seguindo pelo botão de um post, só aquele botão virava "Seguindo"; os outros posts da mesma pessoa continuavam
  com "Seguir";
- o "Quem seguir" continuava mostrando a pessoa com "Seguir";
- seguindo pelo "Quem seguir", os posts dela continuavam com "Seguir";
- abrindo um post e voltando, o feed guardado voltava com os botões como estavam antes.

## O que mudou

Seguir ou deixar de seguir alguém por qualquer botão atualiza **todos os botões daquela pessoa**: os outros posts
dela, o "Quem seguir", o perfil e o feed guardado ao abrir um post. Cada botão guarda de quem ele é (`data-conta`), e
uma lista com referências fracas (`WeakRef`) a todos os botões permite atualizá-los. Os que saíram da tela vão embora
da lista sozinhos.

Continua como antes (e como no X): ao recarregar, os posts de quem você já segue não mostram o botão, e quem você já
segue sai do "Quem seguir". Para deixar de seguir, use o perfil da pessoa.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `botaoDeSeguir` registra cada botão; `avisarBotoesDeSeguir` atualiza os da mesma conta |

## Testes

Conferido em um navegador: seguir a Bia por um post deixa os dois posts dela e o "Quem seguir" como "Seguindo";
seguir o Caio pelo "Quem seguir" faz o mesmo nos posts dele; deixar de seguir num post aberto e voltar reflete no
feed guardado; o banco tem as três contas seguidas; o perfil mostra "3 seguindo"; o feed "Seguindo" traz os posts
delas. `npm test` (61) passando. Não há teste automático da tela.
