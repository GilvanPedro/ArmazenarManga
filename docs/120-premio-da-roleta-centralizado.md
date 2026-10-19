# 120 · O prêmio da roleta centralizado

Dois defeitos no cartão do prêmio da roleta ([doc 115](115-roleta-da-loja.md)), vistos numa captura de tela do dono.

## A capa encostada à esquerda

A prévia do item fica dentro de um botão (clicar abre a pré-visualização na Biblioteca). O botão era um bloco comum, e
nele a prévia (que tem largura máxima) ficava encostada à esquerda, com sobra só do lado direito. Agora o botão
(`.abrir-previa`) centraliza o que tem dentro. Isso valia também para os cartões das bordas e efeitos da loja, que
ficaram centralizados junto.

## "null" embaixo do cartão

Na demonstração do dono (que não guarda o prêmio), a linha "Já está na sua mochila." não existe, e o lugar vazio virava
o texto "null" na tela. Agora os lugares vazios ficam de fora.

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.abrir-previa` centraliza a prévia |
| `public/app.js` | Os prêmios sem o "null" |

## Como foi testado

Medindo a sobra de cada lado da capa: no prêmio, 42 px dos dois lados no computador (o dono, na demonstração) e 15 px
dos dois lados no celular (uma conta comum, no giro grátis); nos cartões da loja, sobras iguais dos dois lados. Nenhum
"null" na tela. Os testes passam.
