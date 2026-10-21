# 127 · Banner ampliado no relatório

No relatório de um banner (a página da empresa e o relatório no gerenciamento), **clicar numa imagem do banner abre
ela grande**, numa janela por cima da página, para ver melhor.

- A imagem aparece do maior tamanho que couber na tela, centralizada, sobre um fundo escuro.
- Fecha no **×**, com **Esc** ou clicando fora da imagem.
- Vale para a horizontal e para a vertical ([doc 126](126-as-duas-imagens-no-relatorio-do-banner.md)).
- Passar o mouse levanta um pouco a imagem e o cursor vira uma lupa, para mostrar que dá para clicar. Cada imagem é um
  botão, então também abre pelo teclado (Tab e Enter).
- Quem pediu menos movimento no aparelho vê a janela abrir sem a animação.

Por dentro: `imagemAmpliavel(src, alt, formato)` faz o botão com a imagem, e `ampliarImagem(src, alt)` abre a janela
(`dialog.janela-da-imagem`). As duas podem ser usadas em outras telas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `imagemAmpliavel` e `ampliarImagem`, usadas no relatório |
| `public/app.css` | O botão das imagens e a janela da imagem ampliada |
