# 114 · Sorteio no estilo de abrir um baú

O botão **🎲 Sortear** da Biblioteca deixou de ir direto para a página do mangá: agora abre um sorteio no estilo de
abrir um baú (como as caixas do CS), baseado no vídeo `viracap_sortear` do dono.

## Como fica

1. A tela escurece e desfoca, e aparece o selo **"Sorteando…"** piscando.
2. Uma **fita de capas** da Biblioteca corre de lado, rápida no começo e cada vez mais devagar (6 s), com uma **mira**
   no meio (moldura e setas na cor de destaque do tema). A capa que passa pela mira acende e cresce um pouco; as
   outras ficam apagadas, e as pontas da fita somem num degradê. A fita não para sempre no centro exato da capa, para
   dar suspense.
3. Ela para no sorteado. O selo vira **"Hoje eu leio:"**, a capa aparece grande com uma **moldura dourada** e brilho,
   sai **confete** do meio da tela, e embaixo vêm o nome e a linha **"nota 10 · Ler 58"** (a nota, se tiver, e o
   próximo capítulo).
4. Os botões: **Ler** (o próximo capítulo no site, como o botão Ler de sempre, ou Ler novamente e o último capítulo
   nos concluídos), **Ver o mangá** e **🎲 Sortear de novo**.

Dá para **pular** a fita (botão Pular), fechar no ×, no Esc ou clicando fora. Quem prefere menos movimento vai direto
ao resultado, sem a fita e sem o confete.

## Como funciona

- O sorteado vem do servidor **antes** de a fita andar, do mesmo jeito de antes (`/api/mangas/sorteio`, com o filtro de
  status escolhido na Biblioteca, sem repetir o último quando há outros). A fita só mostra o caminho até ele.
- As outras capas da fita vêm de uma página da Biblioteca (até 60, do mesmo status), misturadas e repetidas se forem
  poucas. O sorteado fica na posição 41.
- A fita anda com uma animação só (`transform`, feita pela placa de vídeo); a capa acesa na mira é acompanhada quadro a
  quadro só enquanto a fita anda. O confete é feito de 70 pedacinhos que só mudam `transform` e `opacity` e somem em
  2,6 s.
- `estado.sorteado` continua marcado: abrindo o mangá pelo "Ver o mangá", a página dele mostra "Este foi o sorteado!"
  com o "Sortear outro" (que abre o sorteio de novo).

## Correção junto

As capas de exemplo da pré-visualização da loja ([doc 110](110-pre-visualizar-itens-da-loja.md)) usavam o status
`PARA_LER`, que não existe (o certo é `LER`, "Para Ler"): a etiqueta saía errada nessas capas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `sortear` busca o sorteado e as capas da fita; `abrirSorteio`, `capaDaFita` e `confete`; o status das capas de exemplo |
| `public/app.css` | A janela do sorteio: selo, fita, mira, setas, o sorteado com a moldura dourada, os botões e o confete; o celular |

## Como foi testado

No navegador, com uma conta de 20 mangás, no computador e no celular: a fita correu e foi diminuindo, a capa que parou
na mira era a sorteada (conferido pela imagem), o resultado mostrou o nome, "nota 6 · Ler 14" e os três botões, o
confete apareceu, o **Sortear de novo** abriu outro sorteio, o **Pular** levou direto ao resultado e o Esc fechou. Os
testes passam.

> O mesmo sorteio também existe na aba Descobrir, com obras que ainda não estão na lista: veja [Sorteio no Descobrir](123-sorteio-no-descobrir.md).
