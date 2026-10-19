# 108 · Palácio Zen: o vídeo no banco e as cores da pintura

Dois ajustes no tema [Palácio Zen](107-tema-palacio-zen-em-video.md), a pedido do dono.

## O vídeo no banco

O vídeo de fundo e a imagem parada saíram dos arquivos do site e foram para o **banco**, na tabela das imagens da loja
(`imagens_da_loja`, a mesma das molduras de imagem), servidos em `/api/loja/imagens/{nome}`:

| Arquivo no banco | Tamanho |
|------------------|---------|
| `palacio-zen-1.webm` (vídeo, VP9) | 1,7 MB |
| `palacio-zen-1.mp4` (vídeo, H.264, para o Safari e o iPhone) | 1,2 MB |
| `palacio-zen-1.jpg` (a imagem parada) | 59 KB |

Para isso, as imagens da loja passaram a aceitar **vídeo WebM e MP4** (e imagem JPEG), conferidos pelo conteúdo do
arquivo (não pelo nome), até 3 MB (a função do Vercel não devolve mais que 4,5 MB). Os vídeos:

- respondem **por pedaço** (`Range`, 206), que o Safari exige para tocar vídeo;
- ficam guardados **uma semana** no navegador e na CDN (as imagens continuam uma hora). Um vídeo novo vai com outro
  nome (`palacio-zen-2.webm`), para ninguém ver o antigo guardado.

Dá para enviar pela aba **Imagens da loja** do Gerenciar ou pelo terminal (`node ferramentas/imagens-da-loja.mjs enviar
arquivo.webm`), que agora lê o banco do `.env`.

## Só carrega quando é usado

- O vídeo só é pedido quando o tema está na página. Com outro tema, nada dele é baixado.
- O site só cria o vídeo **depois de saber o tema da conta**: antes, abrindo o site com o tema que ficou guardado no
  navegador (de outro login, por exemplo), o vídeo começava a baixar por um instante mesmo com a conta usando outro
  tema.
- Na loja e nas janelas com o tema de outra pessoa, só a imagem parada (59 KB).
- Trocando de tema, o vídeo sai da página e para de baixar.

## As cores da pintura

As cores do tema saíram da própria pintura: tinta preta (#181818), grafite (#303030), névoa (#a8a8a8), papel de arroz
(#ece8e4) e o vermelho fundo dos bordos (#901830). E não só o fundo:

- **Botões principais** em vermelho de bordo, com degradê e brilho de laca; os outros, em contorno de papel de arroz
  sobre a tinta, com o vermelho ao passar o mouse; cantos mais retos.
- **Barra do topo** em tinta, com uma linha fina vermelha embaixo; a parte aberta e a aba aberta em vermelho.
- **Filtros escolhidos** em papel de arroz com letra de tinta; **"Seguir"** também.
- **Campos** em tinta, com o vermelho ao focar; a seleção de texto em vermelho.
- **Favoritos:** a borda de sempre (roxa) vira tinta e vermelho, e a estrela do favorito vira um selo vermelho (as
  bordas compradas na loja continuam as delas).
- **Iniciais** no lugar da foto em vermelho e tinta; os gráficos e os status em tons da pintura.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Vídeo WebM e MP4 e imagem JPEG nas imagens da loja; `respostaDoArquivo` (o envio por pedaço e o tempo de guarda) |
| `public/app.js` | O vídeo e a imagem vêm do banco; o vídeo só depois de o tema da conta ser confirmado; o envio aceita vídeo |
| `public/app.css` | As cores da pintura no tema; a imagem parada do banco |
| `public/temas/` | Saiu (os arquivos foram para o banco) |
| `vercel.json` | Saiu a regra de `/temas/` |
| `test-api/loja.test.mjs` | Os vídeos, o JPEG e o envio por pedaço |

## Como foi testado

- Os testes passam.
- No banco local: os três arquivos enviados pela ferramenta; o vídeo servido inteiro (200) e por pedaço (206, do
  começo e do fim), e um pedaço fora do arquivo recusado (416); um vídeo de mais de 3 MB recusado.
- No navegador: com o tema, o vídeo veio do banco e tocou; com o tema escuro, **nenhum** arquivo do tema foi pedido; na
  loja, só a imagem parada. A Biblioteca, a página do mangá e a Comunidade com as cores da pintura.
- Os três arquivos foram enviados para o banco de verdade (o do site no ar).
