# 110 · Pré-visualizar os itens da loja na sua Biblioteca

Na loja e na mochila, cada item agora pode ser visto **na Biblioteca da pessoa** antes de comprar ou equipar: clicando
na imagem do item ou no botão **👁 Pré-visualizar**, abre uma janela grande com a Biblioteca como ela fica com aquele
item.

## O que aparece

- O site em miniatura: o topo (Viracap, Biblioteca, Comunidade, Loja, "+ Adicionar" e a conta), as abas, a busca, os
  botões, os filtros de status e a grade de capas. São as **mesmas classes do site**, então cada tema pinta a janela
  exatamente como pinta a página (cores, botões, topo, favoritos).
- As capas são **os mangás da pessoa**, os favoritos primeiro (até 12). Sem conta, ou sem mangás, aparecem capas
  desenhadas de exemplo.
- **Tema:** a janela inteira com o tema, inclusive o fundo animado (os de CSS e os de vídeo: o vídeo toca dentro da
  janela, com a mesma camada clara ou escura do tema).
- **Borda e efeito:** nos favoritos. Se a pessoa tiver menos de três favoritos, os três primeiros aparecem como
  favoritos só na pré-visualização, para dar para ver.
- O item mostrado entra no lugar do equipado do mesmo tipo e o resto continua o que a pessoa usa: ver uma borda mostra
  ela com o tema e o efeito que a pessoa já tem.
- No alto da janela, o **Equipar** ou o **Comprar** do item, para fazer dali mesmo (sem conta, comprar leva para criar
  conta, como na loja). Fecha no ×, no Esc ou clicando fora.

## Leve

- O site de verdade não muda: a pré-visualização é só a janela (o tema da página continua o mesmo, nada é guardado).
- O vídeo de um tema em vídeo só é baixado ao abrir a janela, e sai junto com ela. Enquanto ela está aberta, o vídeo
  de fundo da página pausa; o da janela pausa com a janela sem foco ou a aba escondida, como o da página.
- A miniatura do site não é clicável (fica `inert`): é só para ver.

## Itens futuros

`equipadosDaPrevia(item)` diz o que o item troca. Um tipo novo de item (ex.: um fundo de perfil) só precisa entrar ali
e no CSS para aparecer na pré-visualização.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `abrirPreviaDoItem`, `equipadosDaPrevia`, `capaDaPrevia` e as capas de exemplo; no cartão da loja, a imagem e o botão que abrem a janela, e o botão de equipar ou comprar montado de novo para ela; o vídeo da janela e a pausa do da página |
| `public/app.css` | A janela, a miniatura do site, o vídeo e a camada de cada tema em vídeo, o botão na imagem e o celular |

## Como foi testado

No navegador, com a conta de teste:
- Clicando na imagem do Primavera em Kyoto (com o tema escuro equipado): o vídeo do tema tocou dentro da janela, e o
  tema da página continuou escuro. O Esc fechou a janela.
- O botão "Pré-visualizar" do Página de Mangá: a janela com o fundo animado de CSS do tema.
- Uma borda (Sakura): as capas dos favoritos com a borda, com o tema da pessoa.
- **Equipar** de dentro da janela: fechou a janela e equipou o tema.
- Sem conta, no celular: a janela com as capas de exemplo e o efeito, e o "Comprar" no alto.
- Os testes passam.
