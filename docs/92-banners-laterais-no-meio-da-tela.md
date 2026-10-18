# 92 · Banners laterais no meio da tela

Nas telas largas, os banners verticais das laterais ([doc 91](91-lugares-de-banner.md)) ficavam colados no alto. A
pedido do dono, eles passaram a ficar **na altura do meio da tela**:

- **Loja e Descobrir** (os trilhos fixos): o trilho ocupa da barra do topo (60 px) até o fim da tela, e o banner fica
  centralizado nele.
- **Comunidade, à esquerda:** a coluna da esquerda fica presa na tela (sticky) com a altura da tela abaixo da barra do
  topo, e o banner no meio dela.
- **Comunidade, à direita:** a lateral ocupa a altura da tela: "Quem seguir" em cima e o banner no meio do espaço que
  sobra. Para caber, a imagem ali tem no máximo a altura da tela menos 380 px.

Também: a borda dos banners verticais passou a acompanhar a imagem. Quando a imagem encolhe pela altura da tela, ela
fica no meio do lugar sem as faixas escuras dos lados; imagens menores que o lugar aparecem no tamanho delas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | Os trilhos e as laterais da Comunidade com o banner no meio da altura; a borda do vertical acompanhando a imagem |

## Como foi testado

No navegador, a 1550 px de largura e 820 e 1050 px de altura, com banners verticais de 400 × 1280 e 160 × 600: na
Loja, no Descobrir e nas duas laterais da Comunidade, os banners ficaram na altura do meio da tela. O site compactado
também foi conferido, e os 101 testes passam.
