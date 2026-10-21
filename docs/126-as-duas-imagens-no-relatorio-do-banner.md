# 126 · As duas imagens no relatório do banner

O relatório de um banner (a página que a empresa abre pelo link e o relatório no gerenciamento) mostrava só uma
imagem: a horizontal, quando o banner tinha as duas. A vertical não aparecia.

Agora o relatório mostra **todas as imagens que o banner tem**: a horizontal e a vertical lado a lado, ou só a que
existir. Com as duas, a horizontal encolhe um pouco para a vertical caber ao lado, também no celular, sem a página
rolar para o lado. Cada imagem tem a descrição do banner com o formato entre parênteses, para leitores de tela.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `relatorioDeUmBanner` mostra as imagens de `banner.imagens` |
| `public/app.css` | `.imagens-do-relatorio`, com a horizontal e a vertical lado a lado |

> Clicar numa das imagens abre ela grande, numa janela por cima: veja [doc 127](127-banner-ampliado-no-relatorio.md).
