# 112 · Temas animados a 30 quadros por segundo e vídeos a 24

Mais uma rodada de otimização dos temas animados, depois da [111](111-otimizacao-dos-temas-e-celular.md), medida do
mesmo jeito (Chrome sem tela, a Biblioteca parada por 5 s, o processador de todos os processos do navegador).

## O ritmo das animações

Um fundo que se mexe na tela toda faz o navegador redesenhar a tela inteira a cada quadro, 60 vezes por segundo. Para
um fundo lento (estrelas, pétalas, nebulosas), 30 vezes bastam: quase não se nota, e o trabalho cai muito. O CSS não
tem como baixar esse ritmo (testado com `steps()`: o navegador redesenha do mesmo jeito), então:

- O `app.js` pausa as animações sem fim das camadas do tema (as do `<html>` e do `<body>`), das janelas com o tema de
  outra pessoa e da pré-visualização da loja, das prévias de tema na loja e dos enfeites dos favoritos (bordas e
  efeitos da loja), e as adianta ele mesmo **30 vezes por segundo**, todas num relógio comum.
- As animações de uma vez só (o reflexo dos favoritos, as de abrir uma janela, as do mouse em cima) continuam no
  ritmo normal.
- Sem foco, com a aba escondida ou com menos movimento, o relógio para; ao voltar, tudo segue de onde parou (sem
  pulo). As capas e prévias fora da tela continuam paradas (o `data-fora`, doc 100) e também seguem de onde pararam.
- Tema trocado, página nova ou janela aberta: as animações novas entram no relógio já no quadro seguinte.

## Os vídeos a 24 quadros por segundo

Os três temas em vídeo foram refeitos a 24 quadros por segundo (o do cinema), em vez de 30: a cena é lenta e fica
igual, e há menos quadros para decodificar e desenhar. Os arquivos também ficaram menores. Os nomes mudaram (o
navegador guarda os vídeos por uma semana, então um vídeo novo precisa de outro nome):

| Tema | Deitado | Em pé |
|------|---------|-------|
| Palácio Zen | `palacio-zen-2` 1,6 MB (era 1,7) | `palacio-zen-retrato-2` 943 KB (era 990) |
| Primavera em Kyoto | `kyoto-3` 168 KB (era 209) | `kyoto-retrato-3` 114 KB (era 141) |
| Lâmina Sombria | `lamina-3` 1,8 MB (era 2,1) | `lamina-retrato-2` 1,3 MB (era 1,5) |

(os tamanhos são do WebM; o MP4, para o Safari, é menor ainda.) As versões antigas saíram do banco.

## Resultado

| | Antes (computador / celular) | Depois (computador / celular) |
|---|---|---|
| Estrelas, Sakura, Aurora, Galáxia | 84 a 105% / 46 a 69% | 84 a 85% / 44 a 51% |
| Página de Mangá, Matsuri, Entardecer | 100 a 102% / 35 a 41% | 64 a 75% / 32 a 37% |
| Fazenda, Synthwave | 65 a 83% / 32 a 48% | 50 a 68% / 24 a 34% |
| Palácio Zen | 74% / 41% | 61% / 35% |
| Lâmina Sombria | 69% / 38% | 56% / 33% |
| Primavera em Kyoto | 33% / 17% | 28% / 17% |

No Chrome sem tela, o desenho é feito pelo processador; num aparelho com placa de vídeo os números são bem menores. No
computador, o "antes" de vários temas já estava no teto (um núcleo inteiro), então a economia de verdade é maior do que
a tabela mostra.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | O relógio dos fundos animados (`QUADROS_DO_FUNDO`, `pegarAnimacoesDoFundo`); os vídeos novos em `FUNDOS_EM_VIDEO` |
| Banco (imagens da loja) | Os 12 vídeos a 24 quadros por segundo; os antigos apagados |

## Como foi testado

- As medições acima, com todos os temas animados, no computador e no celular.
- O relógio: uma animação do tema andou 990 ms em 1 s, e 0 ms com a janela sem foco.
- Equipando um tema animado pela loja, as camadas novas entraram no relógio e andaram. A pré-visualização da Galáxia
  animou. As bordas animadas da loja andaram na tela e pararam fora dela. O reflexo dos favoritos continuou passando.
  O Palácio Zen tocou o vídeo novo.
- Os testes passam.
