# 73 · O tema da pessoa no perfil e nas listas

Ajuste feito em outubro de 2026 na Comunidade (veja [Temas do site](67-temas-do-site.md) e
[Tema Silhueta e o tema no perfil](70-tema-silhueta-e-tema-no-perfil.md)): ao ver o que é de outra pessoa, aparece o
**tema, a borda e o efeito dela**, e nunca o tema de quem está vendo.

## O que muda

- **O perfil de outra pessoa:** a página toda fica com o tema dela (cores, fundo e animação), enquanto você está no
  perfil. Ao sair (para o feed, a Biblioteca, a loja...), volta o seu. Abrir um post a partir do perfil mostra o post
  com o seu tema; voltar para o perfil traz o tema dela de novo. No seu próprio perfil, fica o seu tema.
- **Os mangás do perfil** (a janela aberta pelo número de mangás): com o tema da pessoa, como antes, e agora também
  quando ela usa o Automático (veja abaixo).
- **As listas dos posts:** a janela que abre com a lista (e com o mangá, numa lista de um só) usa o tema de quem
  publicou, mesmo aberta pelo feed, junto com a borda e o efeito dele nas capas (que já apareciam).
- **Quem usa o Automático:** antes, a janela dos mangás ficava com o tema de quem estava vendo. Agora fica com o tema
  de sempre do site: escuro, ou claro se o aparelho de quem vê estiver no modo claro. Um tema comprado de quem vê nunca
  aparece no que é de outra pessoa.

## Como funciona

- O autor de cada post passou a trazer o `tema` (só um que ainda existe na loja, veja
  [Sem tema de imagem de fundo](72-sem-tema-de-imagem.md)), como já trazia a borda e o efeito.
- `temaParaVer` (`app.js`) dá o tema de outra pessoa para mostrar: o que ela equipou, ou o escuro ou o claro de sempre.
- `mostrarTemaNaPagina` troca o tema da página só na tela, sem guardar no navegador. O perfil de outra pessoa põe o
  tema dela; ao trocar de tela, `rota` volta o da conta. A tela guardada ao abrir um post leva o tema junto, para a volta
  ao perfil.
- As duas janelas (os mangás do perfil e a lista do post) usam a classe `.janela-com-tema`: com o `data-tema` da
  pessoa e as quatro camadas do fundo animado (`.fundo-da-previa` a `.fundo-da-previa-4`).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade_rotas.js` | O autor dos posts traz o `tema` |
| `public/app.js` | `temaParaVer`, `mostrarTemaNaPagina`, o tema no perfil de outra pessoa e na lista dos posts, e a volta do tema ao voltar de um post |
| `public/app.css` | `.janela-com-tema` no lugar da regra que era só da janela dos mangás |

## Como foi testado

Num banco local, com a Luna usando o Synthwave: no feed, o Synthwave; a lista da Mei aberta pelo feed, com a Galáxia
dela; o perfil da Mei todo com a Galáxia, e a janela dos mangás dela também; um post aberto pelo perfil com o
Synthwave, e a volta ao perfil com a Galáxia; o perfil do Kai (Automático) com o escuro de sempre; e a Biblioteca de
novo com o Synthwave. Os 88 testes da versão JavaScript passam.
