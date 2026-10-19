# 107 · Tema Palácio Zen, com fundo em vídeo

Tema animado novo na loja (R$ 7,50, como os outros animados), feito a partir de um papel de parede animado que o dono
mandou: uma pintura em tinta de um palácio japonês sobre a água, com bordos vermelhos e pássaros voando (7 s em loop).

## O vídeo

O original tinha 34 MB (4K, 60 quadros por segundo), pesado demais para baixar a cada visita, e a função do Vercel não
devolve mais que 4,5 MB, então ele não podia vir do banco. Ele foi reduzido para 1280 × 720, 30 quadros por segundo,
sem som, e vai junto com os arquivos do site (servidos pela CDN do Vercel, guardados por um ano no navegador):

| Arquivo | Tamanho | Para |
|---------|---------|------|
| `public/temas/palacio-zen-1.webm` (VP9) | 1,7 MB | Chrome, Edge, Firefox, Opera |
| `public/temas/palacio-zen-1.mp4` (H.264) | 1,2 MB | Safari e iPhone |
| `public/temas/palacio-zen-1.jpg` | 60 KB | A imagem parada (prévia da loja e quem prefere menos movimento) |

O número no nome (`-1`) muda se o vídeo for trocado, para o navegador não usar o antigo guardado.

## Como funciona

- Com o tema na página (o `data-tema` do `<html>`, inclusive no perfil de quem usa o tema), o site põe um `<video>`
  fixo atrás de tudo, em loop, sem som. Trocando de tema, ele sai.
- **Meio escuro:** a pintura é bem clara, então uma camada escura por cima (de 58% a 72%) deixa o fundo escuro para a
  leitura, com o vermelho dos bordos ainda aparecendo. As cores do tema são escuras, com o vermelho dos bordos no
  destaque.
- O vídeo **pausa** com a janela sem foco ou a aba escondida, e volta sozinho. Quem prefere menos movimento vê só a
  imagem parada.
- Na loja e nas janelas com o tema de outra pessoa, aparece a imagem parada (com a mesma camada escura), para não
  tocar vários vídeos ao mesmo tempo.

**Direitos:** o papel de parede veio do site MoeWalls. Antes de vender o tema, vale confirmar que a arte pode ser
usada assim (ou trocar por uma arte própria ou licenciada).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | O tema `palacio` |
| `public/temas/` (novo) | O vídeo em WebM e MP4 e a imagem parada |
| `public/app.js` | `FUNDOS_EM_VIDEO` e `sincronizarFundoEmVideo` (o vídeo de fundo, a pausa) |
| `public/app.css` | As cores do tema, o vídeo atrás de tudo, a camada escura e a prévia |
| `vercel.json` | Os arquivos de `/temas/` guardados por um ano |

## Como foi testado

No navegador, com o tema equipado: o vídeo tocou (o tempo andou 1 s em 1 s), pausou com a janela sem foco e voltou;
a Comunidade e a Biblioteca ficaram com o fundo meio escuro e a pintura aparecendo; a prévia da loja mostrou a imagem
parada; trocando para o tema escuro, o vídeo saiu da página. Os testes passam e o site compactado foi conferido.

> Depois, o vídeo foi para o banco e o tema ganhou as cores da pintura: veja [Palácio Zen: o vídeo no banco e as cores da pintura](108-tema-palacio-no-banco-e-cores.md).
