# 100 · O site muito mais leve para o processador

O dono relatou o site travando e pesando o computador. Medindo (Chrome, 1550 × 820, biblioteca com 12 favoritos,
parado, sem mexer em nada), o problema eram as **animações**: quase todas animavam propriedades que obrigam o
navegador a **redesenhar a capa a cada quadro** (60 vezes por segundo, em cada capa): ângulos com `@property`,
`background-position`, `box-shadow`, `filter`, `color`. Só `transform` e `opacity` são feitas pela placa de vídeo sem
redesenhar nada.

## Antes e depois

Trabalho da página (script, estilo, layout e pintura) por segundo, parada:

| Situação | Antes | Depois |
|----------|-------|--------|
| Biblioteca sem borda | 195 ms/s | 1 ms/s |
| Borda Aurora Boreal | 857 ms/s (quase um núcleo inteiro) | 1 ms/s |
| Borda Abissal | 732 ms/s | 1 ms/s |
| Borda Neon | 251 ms/s | 1 ms/s |
| Borda Galáxia | 195 ms/s | 1 ms/s |
| Efeito Neve | 818 ms/s | 1 ms/s |
| Efeito Retícula / Feixes / Linhas de Ação | 239 / 221 / 181 ms/s | 1 ms/s |
| Loja (bordas) | 236 ms/s | 1 ms/s |

CPU total do navegador (todos os processos, num computador de teste **sem** placa de vídeo, em que a composição das
camadas também cai no processador): Abissal 410% → 51%, Neve 383% → 46%, Galáxia 318% → 51%, Neon 239% → 45%. Com
placa de vídeo, essa parte que sobrou vai para ela.

## O que mudou

1. **Só anima o que aparece.** As capas favoritas e as prévias da loja fora da tela (mais para baixo na lista, em
   outra parte da loja) ficam com as animações pausadas (`data-fora`, com um `IntersectionObserver`). Com 40
   favoritos, só os ~12 visíveis animam.
2. **Janela sem foco pausa tudo.** Usando outro programa (um jogo, por exemplo) com o site aparecendo do lado, as
   animações param; voltam ao clicar no site. Com a aba escondida, o navegador já pausava sozinho.
3. **Toda animação de capa virou `transform`/`opacity`**, com a mesma aparência:
   - **Luz que anda na moldura** (Neon, Cyberpunk, Elétrico, Chamas, Abissal, Cristal, Sombrio): uma camada nova atrás
     da imagem (`.luz-da-moldura`, cortada no formato da moldura) com o degradê grande, que se move; a imagem cobre o
     miolo.
   - **Aurora Boreal e Eclipse:** a luz que dá a volta é um quadrado com o degradê cônico que **gira**, atrás da
     imagem. O brilho de fora da Aurora é desenhado uma vez (borrado) e respira pela opacidade; o anel de diamante do
     Eclipse foi para a estrela do favorito, no mesmo canto e no mesmo tempo.
   - **Brilhos que pulsam** (Neon, Galáxia, Cristal, Sombrio, Elétrico; o brilho das molduras de imagem, da Celestial e
     do Portão do Inferno): a sombra/o brilho fica parado numa camada e só a opacidade muda.
   - **Efeitos:** ganharam uma camada própria (`.camada-do-efeito`), cortada no formato da capa, para as partes que
     andam (neve, chuva, brasas, o arco-íris holográfico, a faixa da TV) serem camadas maiores que se movem sem passar
     para fora — também nas bordas com enfeite, em que a capa não corta. A aura troca de cor revezando três luzes
     paradas; os raios piscam pela opacidade; a retícula respira pela opacidade; as linhas de ação e os feixes giram
     a camada.
   - **Reflexo do favorito** (o brilho que passa na capa de todo favorito): uma faixa larga que anda de lado. As bordas
     com enfeite (que saem da capa) ficaram sem ele.
   - **Arcano:** as runas ficam acesas e a plaquinha respira pela opacidade. **Cyberpunk:** as luzes do circuito
     piscam em sequência.
4. **Temas:** a grade do Synthwave anda com `transform` (o plano inteiro avança um quadradinho) e o sol pulsa pela
   opacidade; as asas dos pássaros (Fazenda e Entardecer) batem achatando o bando (`scale`).
5. **Barra do topo sem desfoque do fundo** (`backdrop-filter`): com o fundo animado dos temas, o desfoque era refeito a
   cada quadro pela placa de vídeo. Ela ficou 95% opaca (antes 88% com desfoque); a diferença quase não aparece.
6. **Menos camadas presas na placa de vídeo:** saiu o `will-change` das capas (o navegador promove sozinho enquanto
   anima); ficou só nas camadas de fundo dos temas.

Quem prefere menos movimento (configuração do aparelho) continua vendo tudo parado.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | As camadas `.camada-do-efeito` e `.luz-da-moldura` nos favoritos; a pausa fora da tela (`IntersectionObserver`) e sem foco |
| `public/app.css` | As animações reescritas com `transform`/`opacity`; a pausa; a barra do topo sem desfoque; o `will-change` só nos temas |

## Como foi testado

- As medições acima, com o Chrome (métricas de desempenho e o tempo de CPU dos processos), antes e depois, nas 20
  bordas, nos efeitos, nos 9 temas animados e na loja.
- Uma folha com a capa de cada borda e de cada efeito, com a animação parada num momento escolhido: mesma aparência
  de antes (a Aurora com a luz colorida na moldura e o brilho, o Eclipse com a luz e o anel no canto, a neve, a chuva,
  as brasas, a faixa da TV etc.).
- A pausa: rolando até o fim da lista, as 24 animações das capas de cima pausaram; voltando, rodaram; com a janela sem
  foco, pausaram; com foco, voltaram.
- Todas as páginas abertas sem erro, e os 101 testes passam.

> Mais otimizações e os vídeos em pé no celular: veja [Otimização dos temas animados e dos vídeos no celular](111-otimizacao-dos-temas-e-celular.md).
