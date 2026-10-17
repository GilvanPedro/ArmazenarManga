# 66 · Capturas da tela para o Google

Continuação de [Nome do site no Google e apresentação](54-nome-do-site-e-apresentacao.md), feita em outubro de 2026:
o site passou a ter **imagens da interface** que o Google pode mostrar na busca (inclusive na busca de imagens).

## As capturas

Três imagens em `public/capturas/`, de 1600 × 1000 px em WebP:

| Arquivo | O que mostra | Tamanho |
|---------|--------------|---------|
| `biblioteca.webp` | A Biblioteca: as capas com status, nota, favoritos com borda e o próximo capítulo | 72 KB |
| `comunidade.webp` | A Comunidade: um post com lista, posts com #tags, curtidas, comentários e "Quem seguir" | 42 KB |
| `manga.webp` | A página de um mangá (Frieren): status, último capítulo, dia do lançamento, nota, tags, sinopse e os parecidos | 52 KB |

Foram tiradas num banco local, com **pessoas e capas de exemplo**: as contas (Luna, Kai, Mei, Renato, Sora e Bea) são
inventadas, as capas são desenhos feitos para isso (formas e o nome da obra, sem a arte original) e as sinopses foram
escritas para as capturas. Nenhum dado de leitor de verdade aparece. Os nomes das obras são reais, porque são o que
as pessoas pesquisam.

Essas imagens são arquivos do projeto, e não do banco (como as da loja, veja [Imagens da loja no banco](63-imagens-da-loja-no-banco.md)),
porque o Google precisa de um endereço fixo e aberto, sem login.

## Onde elas aparecem

- **Na página inicial**, embaixo da apresentação (que fica embaixo do formulário de entrar): o título "Como é por
  dentro" e as três capturas lado a lado (uma embaixo da outra no celular), cada uma com a legenda. Clicar abre a
  imagem grande. Cada imagem tem um texto alternativo descrevendo o que mostra.
- **Nos dados estruturados** do `index.html`: além do `WebSite`, um `WebApplication` (aplicativo da web, grátis, em
  português) com as três capturas no campo `screenshot`, cada uma com a legenda.
- **No `sitemap.xml`**, com a extensão de imagens do Google: as três capturas ligadas à página inicial.

## O que fazer no Search Console

Depois de publicar, no Google Search Console:

1. Em **Sitemaps**, enviar o `sitemap.xml` de novo (para o Google ler as imagens novas).
2. Em **Inspeção de URL**, inspecionar `https://viracap.vercel.app/` e clicar em **Solicitar indexação**.

Quem decide se e quando mostrar as imagens é o Google; costuma levar de alguns dias a algumas semanas.

## Para trocar as capturas

As capturas mostram a interface de outubro de 2026. Se a tela mudar bastante, tire outras no mesmo tamanho, com dados
de exemplo, e substitua os arquivos com os mesmos nomes. Os textos ficam em `CAPTURAS_DO_SITE` (`app.js`), no
`index.html` e no `sitemap.xml`.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/capturas/*.webp` | Novos: as três capturas |
| `public/app.js` | "Como é por dentro" na página inicial (`CAPTURAS_DO_SITE`) |
| `public/app.css` | As capturas lado a lado; a apresentação ficou mais larga (980 px) |
| `public/index.html` | Dados estruturados com `WebApplication` e as capturas |
| `public/sitemap.xml` | As capturas com a extensão de imagens |

## Como foi testado

Na página inicial sem login, no computador (tema escuro) e no celular (390 px, tema claro), sem rolagem para o lado:
as três capturas carregaram e clicar numa abriu a imagem grande. Os dados estruturados e o sitemap foram conferidos
como JSON e XML válidos. Os 86 testes da versão JavaScript passam.
