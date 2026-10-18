# 96 · Banner com imagem horizontal e vertical

Antes, cada banner tinha uma imagem só e um formato (horizontal ou vertical). Agora um banner pode ter **a imagem
horizontal, a vertical ou as duas**, com **no mínimo uma**.

## No cadastro (Gerenciar → Banners)

A escolha de "Formato" saiu. No lugar, dois quadros, um embaixo do outro: **Imagem horizontal** e **Imagem vertical**.
Cada um tem a prévia, o botão de escolher o arquivo, as medidas conferidas na hora (✓ serve / ✗ não serve, com as
medidas recomendadas) e, quando já há imagem, **Tirar** (e "Manter a atual", para desfazer). Salvar sem nenhuma imagem
mostra "O banner precisa de pelo menos uma imagem: a horizontal, a vertical ou as duas", e o servidor recusa do mesmo
jeito.

## No site

Os lugares de banner ([doc 91](91-lugares-de-banner.md)) sorteiam entre os banners que têm a imagem do formato deles:
um banner com as duas imagens entra nos lugares horizontais **e** nos verticais. As exibições e os cliques continuam
somados por banner e lugar.

Na lista do Gerenciar, cada banner mostra as prévias das imagens que tem, o selo "Horizontal", "Vertical" ou
"Horizontal + vertical" e as medidas de cada uma. O relatório geral mostra o formato do mesmo jeito, e o relatório da
empresa mostra as imagens com as medidas.

## No banco

Tabela nova `imagens_de_banner` (banner, formato, imagem, tipo, largura, altura, atualizada_em), uma linha por
imagem, apagada junto com o banner. Na primeira chamada depois da atualização, as imagens que estavam na tabela
`banners` (colunas `imagem`, `tipo_imagem`, `largura`, `altura`, no formato da coluna `formato`) passam para a tabela
nova e essas colunas ficam vazias: nenhum banner perde a imagem.

A imagem é servida em `/api/banners/{id}/imagem?formato=horizontal` (ou `vertical`); sem `formato` (endereços
antigos), vem a horizontal, ou a vertical se não houver horizontal.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | A tabela `imagens_de_banner` e a passagem das imagens antigas; o cadastro com as duas imagens (`imagemHorizontal`, `imagemVertical`, `removerHorizontal`, `removerVertical`); a lista, os relatórios, os banners no ar e a imagem por formato |
| `public/app.js` | Os dois quadros de imagem no cadastro; as prévias, o selo e as medidas na lista e no relatório |
| `public/app.css` | Os quadros de imagem e as prévias lado a lado |
| `test-api/banners.test.mjs` | Os campos do formulário sem o formato |

## Como foi testado

- Os 101 testes passam.
- Num banco local com 3 banners antigos (um horizontal e dois verticais): depois da atualização, as 3 imagens estavam
  na tabela nova e nenhuma ficou na antiga.
- Pela rota do cadastro: sem imagem (recusado), com as duas (salvo como "Horizontal + vertical"), com uma vertical
  deitada (recusado com as medidas), tirando a vertical (ficou só a horizontal), tirando a horizontal também
  (recusado: precisa de uma) e pondo a vertical de novo. A imagem por formato e sem formato responderam certo.
- No navegador: a janela de edição com as duas prévias e "Tirar", a janela nova recusando salvar sem imagem, e o banner
  com as duas imagens aparecendo nos verticais da Loja. O site compactado também foi conferido.
