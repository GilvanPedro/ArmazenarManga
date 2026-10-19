# 109 · Temas Primavera em Kyoto e Lâmina Sombria

Mais dois temas animados com fundo em vídeo na loja (R$ 7,50 cada), feitos do mesmo jeito que o
[Palácio Zen](107-tema-palacio-zen-em-video.md): o vídeo fica no banco, nas imagens da loja, e só é baixado quando o
tema está na página ([doc 108](108-tema-palacio-no-banco-e-cores.md)). Os dois vieram de papéis de parede animados que o
dono mandou.

| Tema | Id | Cena | Claro ou escuro |
|------|----|------|-----------------|
| Primavera em Kyoto | `kyoto` | Pixel art: uma cerejeira em flor, uma casinha japonesa com lanternas, um cachorro dormindo e pétalas caindo (15,6 s) | Claro |
| Lâmina Sombria | `lamina` | Preto e branco: uma espadachim na sombra, com a luz correndo pela lâmina da katana (16,9 s) | Escuro |

## Os vídeos

| Arquivo no banco | Tamanho |
|------------------|---------|
| `kyoto-1.webm` / `kyoto-1.mp4` / `kyoto-1.jpg` | 559 KB / 541 KB / 155 KB |
| `lamina-1.webm` / `lamina-1.mp4` / `lamina-1.jpg` | 2,3 MB / 1,7 MB / 35 KB |

- **Kyoto** ficou no tamanho original (1920 × 1080): pixel art reduzida borra os pixels, e o fundo liso deixa o vídeo
  leve mesmo assim. No site, o vídeo é desenhado com `image-rendering: pixelated`, para os pixels ficarem nítidos.
- **Lâmina** veio de 4K e foi reduzida para 1280 × 720, a 30 quadros por segundo, abaixo do limite de 3 MB.

## As cores de cada um

**Primavera em Kyoto**, das cores da cena: o creme do fundo, o rosa da cerejeira, a madeira da casa, o cinza do
telhado e o laranja das lanternas.
- Fundo creme e cartões creme claro, com texto marrom-madeira; uma névoa creme leve sobre o vídeo.
- Botões no estilo de jogo em pixel art: cantos retos e uma sombra dura embaixo (o principal, rosa, "afunda" ao
  clicar).
- Filtros escolhidos e "Seguir" em madeira; a parte e a aba abertas em rosa; o topo com uma linha rosa.
- Favoritos com a borda em rosa e laranja, e a estrela como uma lanterna.

**Lâmina Sombria**, só em preto, cinzas e prata (as cores ficam só nos status, que precisam ser diferentes):
- Uma camada preta (40% a 60%) sobre o vídeo para a leitura.
- O botão principal é a lâmina: prata, com o brilho na diagonal e um leve reflexo; os outros, em contorno com o fio de
  luz ao passar o mouse; cantos quase retos.
- Filtros, "Seguir", a seleção de texto e a aba aberta em branco e preto.
- Favoritos com a borda em aço e a estrela prateada.

**Direitos:** os dois papéis de parede vieram do site MoeWalls, como o do Palácio Zen. Antes de vender, vale
confirmar que a arte pode ser usada assim.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os temas `kyoto` e `lamina` |
| `public/app.js` | Os dois em `FUNDOS_EM_VIDEO` |
| `public/app.css` | As cores, a camada sobre o vídeo e a prévia da loja de cada um |
| Banco (imagens da loja) | Os seis arquivos, enviados com `ferramentas/imagens-da-loja.mjs` |

## Como foi testado

- No navegador, com cada tema equipado: o vídeo veio do banco e tocou. Conferidas a Biblioteca, a página do mangá e a
  Comunidade, e as prévias na loja.
- Os testes passam.
- Os seis arquivos foram enviados para o banco do site no ar.

> Os itens agora podem ser vistos na Biblioteca antes de comprar: veja [Pré-visualizar os itens da loja na sua Biblioteca](110-pre-visualizar-itens-da-loja.md).

> Mais otimizações e os vídeos em pé no celular: veja [Otimização dos temas animados e dos vídeos no celular](111-otimizacao-dos-temas-e-celular.md).
