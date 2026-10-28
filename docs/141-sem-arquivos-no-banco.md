# 141 · Sem arquivos no banco

Com todas as imagens e vídeos no Vercel Blob ([docs 139](139-imagens-no-vercel-blob.md) e
[140](140-todas-as-imagens-no-blob.md)), a parte do banco onde os arquivos ficavam saiu: as colunas e o código que
gravava e lia arquivos de lá.

## As colunas que saem

| Tabela | Coluna | Era |
|--------|--------|-----|
| `imagens` | `conteudo` | as capas e as fotos de perfil (e as miniaturas que o navegador fazia) |
| `imagens_da_comunidade` | `conteudo` | as imagens dos posts e as cópias das capas das listas |
| `imagens_da_loja` | `conteudo` | as imagens e os vídeos da loja |
| `imagens_de_banner` | `imagem` | as imagens dos banners |
| `banners` | `imagem`, `tipo_imagem`, `formato`, `largura`, `altura` | a imagem única de cada banner, de antes do [doc 96](96-banner-com-imagem-horizontal-e-vertical.md) (vazias desde então) |

**Com segurança:** a limpeza roda sozinha na publicação, no fim da estrutura do banco (`SEM_ARQUIVOS_NO_BANCO`, em
`api/_imagens.js`). Cada coluna só sai **depois de conferir, na hora, que está vazia em todas as linhas**. Se houver um
arquivo nela, aquela coluna fica, e nada se perde. Testado: com um arquivo na coluna, ela ficou (com o arquivo
intacto); vazia, saiu.

Num banco novo, as tabelas já nascem sem essas colunas.

## O que sai do código

- A gravação de arquivos no banco quando o Blob estava desligado: **sem o Blob, enviar uma imagem agora é recusado**
  com "O armazenamento de imagens não está disponível agora. Tente de novo em instantes" (erro 503), em vez de ir para
  o banco. Vale para capas, fotos de perfil, imagens de posts, banners e arquivos da loja.
- A entrega de arquivos pelo banco: os endereços antigos (`/api/imagens/...`, `/api/comunidade/imagens/...`, a foto de
  perfil, as capas pelo perfil, os banners e `/api/loja/imagens/...`) só redirecionam para o Blob.
- A entrega dos vídeos da loja em pedaços pelo servidor: o Blob faz isso.
- As miniaturas guardadas no banco: a versão pequena de cada capa já está no Blob, e o pedido de guardar uma miniatura
  só devolve o endereço dela.
- A otimização dos banners antigos no primeiro pedido, e a migração deles de antes do doc 96.
- O script `ferramentas/migrar-imagens-para-blob.mjs`: não há mais nada no banco para levar.

## A versão Java

A versão Java antiga (`src/main/java`) guarda e lê as imagens na coluna `imagens.conteudo`, que saiu. O site no ar usa
só a API em JavaScript (Vercel); a versão Java deixa de enviar e mostrar imagens enviadas.

## Testado

Localmente, com a imitação do Blob: banco novo sem as colunas; a limpeza segura (coluna com arquivo fica, vazia sai);
com o Blob, capa, imagem de post, banner e arquivo da loja indo para lá e os endereços antigos redirecionando; sem o
Blob, o aviso 503 e o que já está no Blob continuando a funcionar; no Firefox, a Biblioteca, a página do mangá, a
Comunidade e a Loja com as imagens do Blob e sem erros.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_imagens.js` | `SEM_ARQUIVOS_NO_BANCO` (a limpeza segura), `exigirBlob` e o aviso `SemArmazenamento`; saem `levarParaOBlob` e a leitura pelo banco |
| `api/index.js` | Tabela `imagens` sem `conteudo`; envio exige o Blob; entrega e miniatura só pelo Blob; o aviso vira 503 |
| `api/_comunidade_rotas.js` | Tabela sem `conteudo`; envio exige o Blob; entrega e foto só pelo Blob |
| `api/_banners.js` | Tabelas sem as colunas de imagem; sai a migração de antes do doc 96 e a otimização no pedido |
| `api/_loja.js` | Tabela sem `conteudo`; envio exige o Blob; sai a entrega em pedaços pelo servidor |
| `ferramentas/imagens-da-loja.mjs` | Exige o Blob |
| `ferramentas/migrar-imagens-para-blob.mjs` | Apagado |
| `test-api/loja.test.mjs` | Sem o teste da entrega em pedaços pelo servidor |
