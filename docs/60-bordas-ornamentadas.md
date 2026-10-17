# 60 · Bordas ornamentadas

Sete bordas novas na loja (veja [Loja de bordas e mochila](57-loja-de-bordas.md) e
[Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md)), feitas em outubro de 2026 a partir
de duas imagens de ideias do dono do site. Custam **R$ 4,50**, como as outras; com elas, a loja tem **12 bordas** e
5 efeitos.

## As bordas

| Id | Nome | Como é |
|----|------|--------|
| `cristal` | Cristal | Moldura de gelo que reluz, com brilho azul pulsando, **cristais saindo dos cantos de baixo** e faíscas; floco de neve no lugar da estrela |
| `cyberpunk` | Cyberpunk | Moldura escura de canto reto com uma luz verde e roxa que corre pela borda, uma **segunda moldura de cantos cortados** por fora, trilhas de circuito que andam em cima e embaixo e cantos acesos; símbolo ⌬ |
| `abissal` | Abissal | Água que corre pela borda (verde-água e azul profundo), **bolhas brilhantes subindo pela capa** e uma luz que vem do fundo |
| `sombrio` | Sombrio | Moldura roxa e preta com uma sombra que pulsa, **névoa roxa** saindo pelos lados (que se mexe devagar) e fragmentos de energia; lua no lugar da estrela |
| `floresta` | Floresta | Moldura verde com **folhas nos cantos** (em cima à esquerda e embaixo à direita) balançando e vaga-lumes; ❦ no lugar da estrela |
| `eletrico` | Elétrico | Moldura amarela e azul correndo rápido, um brilho que dá clarões e **dois raios** saindo pelos lados e piscando; ϟ no lugar da estrela |
| `arcano` | Arcano | Moldura de prata com **cantos dourados em losango** e uma **plaquinha de runas** em cima da borda de baixo, que acendem devagar; ✧ no lugar da estrela |

A **Galáxia**, que já existia, também ganhou enfeites por fora: estrelas piscando em volta e um planetinha que flutua
no lado direito.

## Como funciona

- Os enfeites saem da capa (cristais, folhas, raios, névoa). Para isso, cada capa de favorito ganhou uma camada
  vazia, `.enfeite-da-borda` (com o `::before` e o `::after` dela), que só aparece nessas bordas. Nas outras, ela fica
  escondida.
- Com essas bordas, a capa **deixa de cortar** o que passa da moldura (`overflow: visible`). A imagem e as camadas de
  dentro (o brilho e os efeitos) ganham o canto arredondado sozinhas, e a imagem não cresce mais ao passar o mouse,
  para não passar por cima da moldura.
- A névoa da Sombrio fica **atrás** da capa (a capa vira um contexto próprio com `isolation: isolate`).
- A plaquinha da Arcano usa o `::after` da capa (onde ficava o brilho de sempre). Por isso, como a Sakura, ela
  continua aparecendo quando há um efeito equipado.
- As folhas da Floresta são os emojis 🌿 e 🍃, que todo sistema atual mostra.
- Quem pede para o sistema reduzir animações vê as bordas paradas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | As 7 bordas novas |
| `public/app.js` | A camada `.enfeite-da-borda` nas capas de favorito (Biblioteca, página do mangá, listas da Comunidade e prévias da loja) |
| `public/app.css` | As 7 bordas, os enfeites da Galáxia e a regra das bordas ornamentadas |

## Como foi testado

- Os 85 testes da versão JavaScript passam (os testes da loja conferem que toda borda custa R$ 4,50 e que nenhum id
  se repete).
- Na loja, as 12 bordas em 5 colunas; na Biblioteca, com Floresta, Abissal, Cyberpunk e Arcano equipadas nas capas
  dos favoritos (e a capa que não é favorita sem nada). Ajustes feitos olhando as capturas: a luz do fundo da
  Abissal tinha virado um retângulo, as folhas de baixo da Floresta saíam do lugar e as runas da Arcano encostavam
  no título embaixo da capa.
