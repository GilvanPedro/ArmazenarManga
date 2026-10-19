# 121 · Roleta mais leve

Uma rodada de otimização da roleta da loja ([doc 115](115-roleta-da-loja.md)), medida como nas outras (Chrome sem
tela, que desenha pelo processador; os números servem para comparar).

## O que pesava e o que mudou

- **O brilho do "🎁 Girar de graça".** O botão pulsava animando o `box-shadow`, que obriga a redesenhar o botão a cada
  quadro, mesmo com a página parada. Agora o brilho é uma camada por trás que só muda de opacidade, e o pulso só muda o
  tamanho (`transform`): a placa de vídeo faz os dois sem redesenhar nada.
- **As pontas da fita.** As pontas sumiam com um `mask-image` na linha, que a placa de vídeo refazia a cada quadro com
  a fita andando por baixo. Agora são dois degradês parados por cima das pontas (da cor do fundo para transparente),
  desenhados uma vez só.
- **A casa que passava pela mira.** Ela acendia e crescia enquanto a fita andava. Para isso, o site lia a posição de
  cada fita a cada quadro (forçando o navegador a recalcular os estilos) e, a cada troca de casa, parte da fita (que é
  enorme) era redesenhada. Isso saiu: enquanto anda, nada dentro da fita muda, e ela é só uma imagem deslizando. A mira
  e as setas continuam, e o prêmio acende quando a fita para.
- **Montar as fitas.** Cada uma das até 120 casas era montada do zero. Agora cada item diferente é montado uma vez e as
  casas são cópias dele.
- **Uma animação só por fita.** A corrida e o deslize final até o meio da mira ([doc 118](118-roleta-premio-no-meio-e-so-o-que-falta.md))
  viraram uma animação só, com três pontos. Quando a fita para, a animação sai e a fita deixa de ser uma camada à parte
  (`will-change`).

## Resultado

Processador gasto (página + desenho), computador / celular:

| | Antes | Depois |
|---|---|---|
| Roleta parada, com o giro grátis | 42% / 19% | 20% / 13% |
| Girando 3 de uma vez | 109% / 80% | 67% / 37% |
| Montar as 3 fitas | 240 ms / 236 ms | 95 ms / 164 ms |
| Recalcular estilos durante o giro | 318 ms | 225 ms |
| Parada com os prêmios na tela | 48% / 38% | 29% / 30% |

Com os prêmios na tela, o que sobra é a animação do próprio item ganho (a borda, o efeito ou o fundo do tema), que é
para ser vista; ela já anda no relógio de 30 quadros por segundo ([doc 112](112-temas-animados-a-30-quadros.md)) e para
fora da tela.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `animarRoleta`: casas copiadas de moldes, uma animação por fita, sem acompanhar a mira quadro a quadro, e a fita solta ao parar |
| `public/app.css` | As pontas com degradês parados no lugar do `mask-image`; o brilho do giro grátis em camada; sem a casa acesa durante o giro |

## Como foi testado

As medições acima, antes e depois. Com 3 giros e só 6 itens faltando, no computador e no celular: os três prêmios
pararam a 0 px do meio das miras, as fitas só mostraram os itens que faltavam, e o visual da fita girando continuou o
mesmo (as pontas sumindo, a mira e as setas). Os testes passam.
