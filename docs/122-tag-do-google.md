# 122 · Tag do Google (Google Ads)

A tag do Google Ads (`AW-18466219735`) entrou no site, do jeito que o Google entrega (gtag.js).

## Onde fica

O Viracap é uma página só (`index.html`): todas as telas (Biblioteca, Comunidade, Loja, um mangá, um perfil…) abrem
dentro dela, trocando o que vem depois do `#` no endereço. Por isso a tag foi posta uma vez, logo no começo do `<head>`
do `index.html` (depois só do `<meta charset>`), e vale para todas as páginas. O arquivo de verificação do Google
(`googledc43e32b7713b5d9.html`) ficou sem a tag, como deve ser.

## Cada página contada

A tag conta sozinha só a primeira página aberta. Como as outras abrem sem recarregar, o `app.js` manda ao Google uma
visualização de página (`page_view`, com o endereço e o título) a cada troca do `#`, um pouco depois de a tela montar
(para o título já ser o dela). A mesma página seguida não é contada duas vezes.

## A política de segurança (Content-Security-Policy)

O site só deixava rodar os próprios scripts, o que barraria a tag. Em vez de liberar qualquer script escrito dentro da
página (o que abriria a porta para código injetado), foram liberados só:

- o script do Google (`www.googletagmanager.com`) e os que ele carrega para o Ads (`googleads.g.doubleclick.net`,
  `www.googleadservices.com`, `www.google.com`);
- o trecho da tag escrito no `index.html`, **pelo resumo sha256 dele**: se uma letra desse trecho mudar, o navegador
  barra, e o resumo no `vercel.json` (e no `ApiServer.java`) tem que ser trocado junto;
- os envios do Google (`connect-src`) e os quadros dele (`frame-src`).

Na mesma conferência apareceu um defeito antigo: a política não deixava carregar imagens `data:`, que os temas
**Entardecer, Fazenda, Festival de Verão e Página de Mangá** usam em desenhos do fundo (os postes e fios, os morros, as
lanternas, os quadrinhos). Essas partes não apareciam no site no ar. Agora `img-src` aceita `data:` (só imagens).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | A tag do Google no começo do `<head>` |
| `public/app.js` | A visualização de página a cada troca de tela |
| `vercel.json` | O Content-Security-Policy com o Google e as imagens `data:` |
| `ApiServer.java` | A mesma política na versão Java |

## LGPD

A tag do Google Ads usa cookies para medir conversões e fazer remarketing. Pela LGPD, o site precisa avisar disso (numa
política de privacidade ou num aviso de cookies). Ainda não há esse aviso no Viracap.

## Como foi testado

No navegador, com a mesma política de segurança do Vercel, sem conta e com conta: o script do Google carregou, a tag
registrou o `config` do `AW-18466219735`, os envios ao Google saíram, trocar para a Comunidade e para a Loja mandou uma
visualização de página de cada uma, e nada foi barrado pela política nem deu erro. Os testes passam.
