# 54 · Nome do site no Google e apresentação na página inicial

Continuação de [Site no Google](44-site-no-google.md), feita em outubro de 2026.

## O problema

Sem login, o site mostra só a tela de entrar, e é essa a página que o Google lê (as outras telas ficam depois do
`#` e atrás do login). Ela tinha pouco texto: o nome, uma frase e o formulário. Com tão pouco, o Google entende mal
do que o site trata, e nada dizia a ele que o nome do site é "Viracap" (no resultado podia aparecer só o endereço).

## O que mudou

- **Nome do site para o Google.** O `index.html` ganhou um bloco de dados estruturados (`application/ld+json`, tipo
  `WebSite`) com o nome **Viracap**, nomes alternativos, o endereço, a língua e a descrição. É o que o Google usa
  para mostrar o nome do site em cima do link no resultado. O bloco é só dados (o navegador não o executa), então a
  política de segurança do site (`Content-Security-Policy`) não precisou mudar.
- **Apresentação embaixo do formulário de entrar.** A tela de entrar mostra, embaixo do cartão, o título "Sua lista
  de mangás, manhwas e manhuas", uma frase sobre o site e quatro quadros: **Continue de onde parou**, **Lançamentos
  do dia**, **Descubra obras novas** e **Comunidade**. Serve para quem chega pela primeira vez entender o site e dá ao
  Google as palavras que as pessoas pesquisam (mangá, manhwa, manhua, capítulo, lançamentos). No computador os quatro
  quadros ficam lado a lado; no celular, dois por linha. Na tela de criar conta a apresentação não aparece.

## O que falta fazer fora do código

Isso é feito por quem é dono do site, no Google Search Console (search.google.com/search-console):

1. Verificar a propriedade `https://viracap.vercel.app` (o arquivo de verificação já está publicado).
2. Em **Sitemaps**, enviar `sitemap.xml`.
3. Em **Inspeção de URL**, inspecionar `https://viracap.vercel.app/` e clicar em **Solicitar indexação**.
4. Depois de alguns dias, pesquisar `site:viracap.vercel.app` para ver se a página entrou.

O nome "Viracap" no resultado pode levar algumas semanas para aparecer, mesmo com os dados estruturados. Links de
outros lugares para o site (a página da extensão na Mozilla, o GitHub, redes sociais) ajudam o Google a achar e
confiar no site.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | Dados estruturados `WebSite` com o nome Viracap |
| `public/app.js` | Apresentação do site embaixo do formulário de entrar |
| `public/app.css` | Estilo da apresentação (quadros lado a lado, dois por linha no celular) |

## Como foi testado

- No navegador, sem login, no computador (1400 px, tema escuro) e no celular (390 px, tema claro): a apresentação
  aparece embaixo do formulário, sem rolagem para o lado; o bloco de dados é lido como JSON válido com o nome
  "Viracap".
- Os 71 testes da versão JavaScript continuam passando.

> Depois, a página inicial ganhou capturas da interface, também nos dados estruturados e no sitemap: veja
> [Capturas da tela para o Google](66-capturas-da-tela-no-google.md).
