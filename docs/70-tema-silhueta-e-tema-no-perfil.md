# 70 · Tema Silhueta e o tema da pessoa nos mangás do perfil

Dois ajustes feitos em outubro de 2026, nos temas (veja [Temas do site](67-temas-do-site.md)) e na janela dos mangás do
perfil (veja [Os mangás do perfil e a lista de um só](64-mangas-do-perfil-e-lista-de-um.md)).

## Tema Silhueta (de imagem)

Um tema com uma **ilustração de fundo**: uma personagem de mangá em traço preto e branco, presa no canto de baixo à
direita da tela, na altura da tela. Custa **R$ 7,50**, como os animados, porque a imagem tem um zoom bem lento (vai e
volta a cada 14 segundos).

- A imagem (`silhueta.webp`, 1600 × 900, 45 KB) fica **no banco**, como as das bordas (veja
  [Imagens da loja no banco](63-imagens-da-loja-no-banco.md)), e o tema usa `/api/loja/imagens/silhueta.webp`. O
  arquivo pronto ficou em `Downloads/viracap-loja/silhueta.webp` para o dono enviar pela aba **Imagens da loja** do
  site publicado; até lá, o tema aparece só com o fundo cinza.
- O fundo da imagem é um cinza liso (`#181818`), a mesma cor do tema: a imagem se emenda no resto da tela em
  qualquer largura. Os painéis do site ficam meio transparentes por cima dela, e os detalhes são em branco e cinza.
- No celular (até 760 px), a ilustração fica atrás do texto, então ela fica bem apagada.
- A personagem lembra a Hitagi Senjougahara, de *Monogatari*: é uma personagem oficial, e o uso num site que vende
  temas tem o risco de pedido de remoção por direitos autorais.

Foram enviadas duas imagens. A outra (uma personagem de biquíni em pose sensual) não foi usada: é conteúdo
sexualizado, num site com uma Comunidade aberta e um robô que barra imagens explícitas.

## O tema da pessoa nos mangás do perfil

A janela **"Mangás de {nick}"**, aberta pelo número de mangás do perfil, passou a usar o **tema do site da pessoa**:
as cores, o fundo e, nos temas animados, a animação, nas capas e no detalhe de cada mangá. Junto com a borda e o efeito
dela (veja [A borda da pessoa nos mangás do perfil](65-bordas-nos-mangas-do-perfil.md)), a janela fica como a
Biblioteca da pessoa. Se ela usa o tema Automático, a janela fica com o tema de quem está vendo.

Para isso:

- o perfil (`GET /api/comunidade/contas/{id}`) passou a trazer o `tema` da pessoa;
- as regras de cada tema no `app.css` deixaram de valer só para a página e as prévias da loja: valem para **qualquer
  elemento com `data-tema`** (`[data-tema="..."]`), e as camadas animadas desses elementos são `.fundo-da-previa` e
  `.fundo-da-previa-2`. A janela ganhou o `data-tema` da pessoa e essas duas camadas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | O tema Silhueta |
| `api/_comunidade_rotas.js` | O perfil traz o `tema` |
| `public/app.css` | O tema Silhueta; as regras dos temas para qualquer elemento com `data-tema`; a janela dos mangás com o tema |
| `public/app.js` | A janela dos mangás do perfil com o `data-tema` da pessoa e as camadas do fundo |

## Como foi testado

Num banco local: a imagem enviada pela rota da aba Imagens da loja; o Silhueta equipado na Comunidade, com a
personagem à direita atrás dos painéis; e, com a Mei usando a Galáxia, a janela dos mangás dela abriu com a Galáxia
(estrelas e nebulosas) mesmo com quem estava vendo usando o Silhueta, nas capas e no detalhe. Os 87 testes da versão
JavaScript passam.

> Depois, o tema Silhueta saiu da loja (a janela dos mangás com o tema da pessoa continua): veja
> [Sem tema de imagem de fundo](72-sem-tema-de-imagem.md).

> Depois, o perfil inteiro e as listas dos posts também passaram a usar o tema da pessoa, e o Automático dela deixou
> de mostrar o tema de quem vê: veja [O tema da pessoa no perfil e nas listas](73-tema-da-pessoa-no-perfil-e-nas-listas.md).
