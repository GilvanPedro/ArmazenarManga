# 44 · Site no Google

Preparação feita em outubro de 2026 para o site (https://registrar-manga.vercel.app) aparecer na busca do Google e
ter uma prévia bonita quando o link é compartilhado.

## O que dá para aparecer no Google

Só a **página inicial** (a tela de entrar). Todas as outras telas ficam depois do `#` no endereço (`#/comunidade`,
`#/manga/...`), e o Google ignora o que vem depois do `#`. Além disso, as listas e a Comunidade só aparecem para quem
entrou na conta. Para quem procura o site, isso basta: o resultado leva à página inicial.

## O que mudou

- **`index.html`**:
  - título completo (`Meus Mangás · sua lista de mangás, manhwas e manhuas`);
  - **descrição** (o texto embaixo do título no resultado da busca);
  - endereço **canônico**, para o Google tratar `registrar-manga.vercel.app/` como o endereço oficial;
  - marcações **Open Graph** e do Twitter/X, usadas no WhatsApp, Discord, X e outros ao compartilhar o link: título,
    descrição e a imagem `compartilhar.png`;
  - cor do tema (barra do navegador no celular) e ícone para a tela de início do iPhone (`icone-180.png`).
- **Tela de entrar**: o título da aba continua o completo, em vez de "Entrar · Meus Mangás". O Google executa o
  JavaScript da página, então esse é o título que ele vê. A tela de criar conta continua "Criar conta · Meus Mangás".
- **`robots.txt`**: libera o site para os buscadores, deixa a API (`/api/`, os dados de cada conta) de fora e aponta
  para o mapa do site.
- **`sitemap.xml`**: o mapa do site, com a página inicial.
- **`compartilhar.png`** (1200×630): a imagem de prévia, com o logo, o nome e uma frase sobre o site.

## O que falta fazer (no Google Search Console)

Isso precisa ser feito com a conta Google do dono do site:

1. Publicar estas mudanças (commit e push; o Vercel publica sozinho).
2. Abrir https://search.google.com/search-console e clicar em **Adicionar propriedade**.
3. Escolher **Prefixo do URL** e digitar `https://registrar-manga.vercel.app/`. A opção "Domínio" não serve, porque o
   domínio `vercel.app` é do Vercel.
4. Confirmar que o site é seu pelo método **Tag HTML**. O Google mostra uma linha
   `<meta name="google-site-verification" content="...">`, que vai no `<head>` do `index.html`. Depois de publicar,
   clicar em **Verificar** no Search Console. Outra opção é o **Arquivo HTML**: baixar o arquivo do Google, colocar em
   `src/main/resources/public/` e publicar.
5. No menu **Sitemaps**, enviar `sitemap.xml`.
6. Em **Inspeção de URL**, colar o endereço do site e clicar em **Solicitar indexação**.

O Google costuma levar de alguns dias a algumas semanas para mostrar o site. Para conferir, pesquise
`site:registrar-manga.vercel.app`.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | Título, descrição, canônico, Open Graph, Twitter/X, cor do tema e ícone do iPhone |
| `public/app.js` | A tela de entrar mantém o título completo do site |
| `public/robots.txt` | Novo: libera o site, deixa `/api/` de fora e aponta o mapa do site |
| `public/sitemap.xml` | Novo: mapa do site com a página inicial |
| `public/compartilhar.png` | Nova: imagem de prévia ao compartilhar o link |
| `public/icone-180.png` | Novo: ícone da tela de início do iPhone |

## Testes

`sitemap.xml` válido e as marcações conferidas no `index.html`. `npm test` (61) e os testes da versão Java passando.
A versão Java serve os arquivos novos sozinha, porque entrega a pasta `public` inteira.
