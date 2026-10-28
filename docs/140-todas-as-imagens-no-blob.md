# 140 · Todas as imagens no Blob

O [doc 139](139-imagens-no-vercel-blob.md) levou para o Vercel Blob as capas, as fotos de perfil e as imagens dos
posts. Ainda nasciam arquivos no banco em quatro lugares. Agora **nenhuma imagem nova vai para o banco** com o Blob
ligado:

| Onde | Antes | Agora |
|------|-------|-------|
| Banners (Gerenciar → Banners) | a imagem otimizada no banco (`imagens_de_banner`) | no Blob, já otimizada (`banners/<hash>/horizontal.webp`); o site recebe o endereço direto |
| Imagens e vídeos da loja (Gerenciar → Imagens da loja, e `ferramentas/imagens-da-loja.mjs`) | no banco (`imagens_da_loja`) | no Blob, como o dono enviou (`loja/<hash>/<nome>`), sem converter |
| Miniatura de uma capa antiga | uma miniatura nova no banco | a capa vai para o Blob na hora, e a versão pequena sai de lá |
| Capa copiada para uma lista publicada na Comunidade | a cópia no banco, se a capa estava no banco | a capa vai para o Blob na hora, e a lista aponta para os mesmos arquivos |

## Os endereços continuam os mesmos

- Os arquivos da loja são usados pelo CSS por um nome fixo (`/api/loja/imagens/palacio-zen-1.webm`). Esse endereço
  continua, e redireciona para o Blob. O redirecionamento fica guardado pelo mesmo tempo de antes: uma hora para as
  imagens (trocar um arquivo com o mesmo nome aparece em até uma hora) e uma semana para os vídeos. Os vídeos tocam
  direto do Blob, que aceita os pedidos por pedaço que o Safari exige.
- O endereço antigo de um banner (`/api/banners/{id}/imagem?formato=...`) redireciona para o Blob; a lista dos banners
  no ar, o gerenciamento e o relatório já recebem o endereço direto.

## O que ainda estava no banco vai sozinho

Com o Blob ligado, um banner ou arquivo da loja que ainda está no banco vai para o Blob **na primeira vez que alguém
o pede**, uma vez só. O script `ferramentas/migrar-imagens-para-blob.mjs` também passou a levar os banners e os
arquivos da loja.

## Trocar e apagar

- Trocar a imagem de um banner ou um arquivo da loja apaga o arquivo antigo do Blob.
- Apagar um banner ou um arquivo da loja apaga os arquivos dele do Blob.
- Dois banners com a mesma imagem dividem o mesmo arquivo (o caminho é o hash do conteúdo): ele só sai quando nenhum
  banner usa mais.

## O Blob conectado sem a chave

Mesmo com o Blob conectado ao projeto, as capas novas do site publicado ainda iam para o banco: o site não achava
nenhuma `*_READ_WRITE_TOKEN`. Ao conectar um Blob a um projeto, a Vercel pode colocar só o identificador dele
(`BLOB_STORE_ID`) e autenticar o site sozinha, com um token que vai em cada requisição (OIDC); a biblioteca
`@vercel/blob` aceita esse jeito. Agora o servidor considera o Blob ligado com a chave **ou** com o `BLOB_STORE_ID`
(sem a chave, a biblioteca faz a autenticação).

Ao ligar, o servidor escreve no log da Vercel uma destas linhas, com os **nomes** (nunca os valores) das variáveis
que têm "BLOB" no nome:

- `Imagens: Vercel Blob ligado (chave em BLOB_READ_WRITE_TOKEN) | variaveis com BLOB: ...`
- `Imagens: Vercel Blob ligado (BLOB_STORE_ID, sem chave: autenticacao da Vercel) | variaveis com BLOB: ...`
- `Imagens: Vercel Blob desligado; as imagens ficam no banco | variaveis com BLOB: nenhuma`

## No site (28/10/2026)

Depois do deploy com o `BLOB_STORE_ID`, a capa nova de um mangá foi direto para o Blob. O script levou o resto que
ainda estava no banco: 3 capas, os banners e os 19 arquivos da loja (os vídeos dos temas também), 26 no total, sem
falhas. Desde então, **nenhum arquivo de imagem ou vídeo fica dentro do banco**: 87 capas e fotos, 8 imagens de posts,
4 banners e 19 arquivos da loja, todos no Blob. Os vídeos tocam pelo endereço fixo de antes, e o Blob aceita os
pedidos por pedaço (resposta 206).

## Testado

Localmente, com a imitação do Blob: banners e arquivo da loja criados sem o Blob indo para lá no primeiro pedido;
capa antiga no banco indo para o Blob ao entrar numa lista publicada; banner novo com a mesma imagem de outro
reaproveitando o arquivo; troca e remoção de banner e de arquivo da loja apagando só os arquivos sem uso; capa nova
direto no Blob; o script levando banner e arquivo da loja. O log do servidor diz "Imagens: Vercel Blob ligado".

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_imagens.js` | `guardarArquivoNoBlob` (um arquivo inteiro, sem converter) e `levarParaOBlob` (uma imagem do banco, na hora) |
| `api/_banners.js` | Banners no Blob: salvar, entregar, levar os antigos, trocar e apagar |
| `api/_loja.js` | Imagens e vídeos da loja no Blob: enviar, entregar pelo endereço fixo, levar os antigos, trocar e apagar |
| `api/index.js` | A miniatura de uma capa antiga leva a capa para o Blob |
| `api/_comunidade_rotas.js` | A capa de uma lista publicada vai para o Blob antes de ser copiada |
| `ferramentas/imagens-da-loja.mjs` | Envia e apaga no Blob, quando a chave está no `.env` |
| `ferramentas/migrar-imagens-para-blob.mjs` | Leva também os banners e os arquivos da loja |

> Atualização: as colunas onde os arquivos ficavam saíram do banco, o envio sem o Blob passou a ser recusado (em vez de ir para o banco) e o script de migração foi apagado: veja [doc 141](141-sem-arquivos-no-banco.md).
