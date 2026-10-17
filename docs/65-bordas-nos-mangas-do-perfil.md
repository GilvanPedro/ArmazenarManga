# 65 · A borda e o efeito da pessoa nos mangás do perfil

Ajuste feito em outubro de 2026 na janela dos mangás do perfil (veja
[Os mangás do perfil e a lista de um só](64-mangas-do-perfil-e-lista-de-um.md)).

**Antes:** ao abrir os mangás de alguém pelo perfil, as capas dos favoritos apareciam com a borda roxa e o brilho de
sempre, mesmo que a pessoa tivesse equipado outra borda ou efeito da loja.

**Agora:** os favoritos aparecem com a **borda e o efeito que a pessoa equipou**, nas capas da janela e no detalhe de
cada mangá, como na Biblioteca dela.

O motivo era que o perfil (`GET /api/comunidade/contas/{id}`) não trazia a borda nem o efeito da pessoa. Ele passou a
trazer `borda` e `efeito` (nulos quando são os de sempre), e a janela já usava esses campos.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade_rotas.js` | O perfil traz `borda` e `efeito` |

## Como foi testado

Num banco local, com a Bia usando a borda Chamas e o efeito Faíscas, vendo o perfil dela com a conta da Ana: as capas
dos dois favoritos ficaram com `borda-chamas efeito-faiscas`, na grade e no detalhe, e a capa que não é favorita
ficou sem nada. Os 86 testes da versão JavaScript passam.

> Depois, a janela também passou a usar o tema do site da pessoa: veja [Tema Silhueta e o tema no perfil](70-tema-silhueta-e-tema-no-perfil.md).
