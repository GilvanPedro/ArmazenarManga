# 18 · Selo da nota com ícone

Ajuste feito em outubro de 2026 no selo criado em [Nota dos mangás](15-nota-dos-mangas.md).

## O que motivou

- O indicativo da faixa (ruim, médio, bom, muito bom) era uma bolinha colorida na capa e uma palavra na página
  do mangá. A ideia original era uma **imagem pequena** para cada faixa, não um texto.
- O selo na capa estava pequeno e difícil de ver em cima da imagem.

## O que mudou

### Um ícone para cada faixa

| Nota | Faixa | Ícone |
|------|-------|-------|
| 0 a 4 | Ruim | Rosto vermelho, de sobrancelhas franzidas e boca para baixo |
| 5 a 7 | Médio | Rosto amarelo, de boca reta |
| 8 e 9 | Bom | Rosto verde, sorrindo |
| 10 | Muito bom | Rosto azul, com estrelas nos olhos e sorriso aberto |

Os ícones são quatro arquivos SVG em `public/icones/`, desenhados para o projeto. O ícone fica à esquerda do
número, dentro do selo.

O nome da faixa **não é mais escrito** na tela: nem ao lado do seletor da página do mangá, nem nas opções do
seletor, que agora mostram só o número. Ele continua na dica que aparece ao passar o mouse ("Nota 9 de 10 ·
Bom") e no texto lido por leitores de tela.

### Selo maior e mais destacado na capa

- O número passou de 12 para 19 px e o ícone tem 28 px; o selo inteiro foi de cerca de 20 para 40 px de altura.
- Ganhou um contorno branco e uma sombra mais forte, para aparecer sobre capas claras e escuras.
- Em telas estreitas (até 560 px) o selo é um pouco menor, para não cobrir a capa.

O selo continua no canto inferior direito, com fundo preto e número branco.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/icones/nota-*.svg` | Novos: os quatro ícones |
| `public/app.js` | `etiquetaNota` usa o ícone e não escreve mais o nome da faixa; `seletorDeNota` lista só números |
| `public/app.css` | Tamanho, contorno e sombra do selo; fim da bolinha colorida |

O servidor não mudou. Na versão do Vercel os ícones são servidos como os outros arquivos do site.

## Testes

Conferido em um navegador: os quatro ícones carregam, aparecem na faixa certa (inclusive na nota 0), e o selo
foi visto na lista, na página do mangá e em largura de celular. Não há teste automático.
