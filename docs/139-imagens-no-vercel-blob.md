# 139 · Imagens no Vercel Blob, em AVIF e no tamanho certo

As imagens enviadas pelas pessoas (capas, fotos de perfil e imagens dos posts) seguem agora o guia
"Imagens: armazenamento e otimização web": **o arquivo vai para um armazenamento de arquivos (o Vercel Blob) e o banco
fica só com os dados dele**, e o site entrega **a menor versão que serve, no melhor formato que o navegador aceita**.

Antes, as imagens ficavam inteiras no banco (~11 MB de um banco de 49 MB), do jeito que chegavam (com os metadados da
foto) e passavam pela função do servidor a cada visualização.

## Ao enviar uma imagem

1. **Conferida pelo conteúdo**, não pela extensão: só PNG, JPG, GIF e WebP, com limite de tamanho e de pixels (40
   milhões, contra imagens "bomba").
2. **Sem os metadados (EXIF)**: foto de celular pode trazer a localização de quem tirou. A rotação da câmera é aplicada
   antes.
3. **Três larguras, em AVIF e em WebP**, nunca maiores que a original:

   | Imagem | Larguras | Por quê |
   |--------|----------|---------|
   | Capa e foto de perfil | 240, 480, 720 px | na grade a capa ocupa ~110–220 px; na página do mangá, ~320 px; em dobro para telas de alta resolução |
   | Imagem de post | 480, 960, 1440 px | num post ela ocupa até ~600 px |

   Qualidade calibrada: 55 no AVIF e 78 no WebP. GIF animado vira WebP animado (o AVIF animado ainda não é bem aceito).
4. **Uma prévia borrada** de 16 px (~100 a 300 caracteres), que vai junto com os dados e aparece enquanto a imagem
   chega.
5. **Nome feito do conteúdo** (o hash SHA-256): `capas/<hash>/480.avif`. Se o conteúdo muda, o nome muda, então o
   navegador e a CDN podem guardar por um ano. A mesma imagem enviada duas vezes cai no mesmo lugar e não é guardada de
   novo.

Exemplo medido: uma capa JPEG de 1000 × 1500 px (28 KB) vira, em 0,35 s, seis arquivos; a de 240 px em AVIF, que é a
que a lista mostra, tem **1 KB**.

No banco ficam só os dados: o endereço, as larguras, as medidas, o hash, o tamanho e a prévia (colunas novas em
`imagens` e `imagens_da_comunidade`; `conteudo` fica vazio).

## No site

- As capas e as imagens dos posts usam `<picture>` com AVIF e `srcset` com as larguras: **o navegador escolhe**. No
  teste, a capa na grade do computador baixou a de 240 px em AVIF; no celular (tela de alta resolução), a de 480 px; a
  imagem de um post, a de 960 px.
- O espaço da imagem fica reservado antes de ela chegar (largura e altura), sem a página pular.
- A prévia borrada aparece por trás até a imagem chegar.
- As capas das duas primeiras fileiras continuam vindo primeiro, sem esperar a rolagem; o resto, ao chegar perto.
- O endereço vem direto do Blob: abrir uma imagem não passa mais pela função do servidor nem pelo banco.
- A miniatura que o navegador fazia das capas (doc anterior) não é mais necessária para as capas no Blob: as larguras
  pequenas já existem.

Endereços antigos (`/api/imagens/...`, `/api/comunidade/imagens/...`, a foto de perfil) continuam funcionando:
redirecionam para o Blob.

## Apagar

Apagar um mangá, um post, uma imagem solta ou a conta apaga os arquivos do Blob, **menos os que outra imagem ainda
usa** (a mesma imagem enviada duas vezes, ou a capa copiada para uma lista publicada aponta para os mesmos arquivos).

## Sem o Blob ligado

Enquanto o Blob Store não estiver conectado ao projeto, o site continua guardando no banco, como antes, mas já com a
imagem conferida, sem metadados e em WebP (uma versão só, a maior). Assim nada quebra antes de ligar o Blob.

## O que fazer para ligar

1. No painel da Vercel, no projeto: **Storage → Create Database → Blob**, e conecte ao projeto (os três ambientes). A
   chave `BLOB_READ_WRITE_TOKEN` entra sozinha nas variáveis do projeto.
2. Faça um novo deploy (as variáveis novas só valem a partir do próximo).
3. Para levar as imagens que já existem: copie a `BLOB_READ_WRITE_TOKEN` (na página do Blob Store, aba `.env.local`)
   para o `.env` do projeto e rode:

   ```
   node ferramentas/migrar-imagens-para-blob.mjs --simular   # só conta o que seria levado
   node ferramentas/migrar-imagens-para-blob.mjs             # leva
   ```

   O script pode rodar de novo quantas vezes quiser: só pega o que ainda não foi. As miniaturas antigas das capas
   levadas são apagadas. O espaço do banco é liberado aos poucos pelo Postgres.

### A migração no site (28/10/2026)

As imagens que já existiam foram levadas pelo script: **90 imagens** (82 capas e fotos e 8 imagens de posts, ~8,7 MB
no banco) viraram arquivos no Blob, com 0 falhas, e as **43 miniaturas antigas** das capas foram apagadas. Depois disso,
nenhuma imagem ficou com o conteúdo no banco. Os arquivos saem do Blob como `image/avif` (ou WebP), com cache de um ano.

**A chave por qualquer prefixo:** depois da migração, as capas novas do site publicado ainda iam para o banco: a variável
existia na Vercel, mas o site não a achava. Ao conectar o Blob, a Vercel deixa escolher um prefixo, e a variável pode
ficar como `PREFIXO_READ_WRITE_TOKEN` em vez de `BLOB_READ_WRITE_TOKEN`. Agora o servidor aceita os dois: procura a
`BLOB_READ_WRITE_TOKEN` e, sem ela, qualquer variável terminada em `_READ_WRITE_TOKEN` cujo valor comece com
`vercel_blob_rw_` (o começo de toda chave do Blob). Ao ligar, o servidor escreve no log da Vercel
"Imagens: Vercel Blob ligado (chave em NOME)" ou "Imagens: Vercel Blob desligado", sem mostrar o valor.

Lembrete: a chave do Blob só chega ao site publicado em um deploy feito **depois** de conectar o Blob Store ao projeto.
Até esse deploy, as imagens novas continuam indo para o banco (já limpas e em WebP), e o script leva elas depois.

## O que ficou diferente do guia, e por quê

- **O envio passa pelo servidor**, em vez de ir direto do navegador para o Blob com uma autorização temporária: o
  servidor precisa conferir, limpar e converter a imagem (e o robô de imagens confere as dos posts e as fotos). As
  imagens já chegam diminuídas pelo navegador e têm no máximo 4 MB.
- **As larguras são feitas na hora do envio**, sem fila: levam ~0,35 s por imagem.
- **Sem transformação sob demanda** (Vercel Image Optimization, imgproxy): na Vercel, cada transformação é cobrada; as
  larguras feitas no envio não custam nada a cada visita.
- **Capas no Blob ficam públicas** (como já eram as imagens dos posts e as fotos de perfil), num endereço impossível de
  adivinhar. Antes, só a conta dona via a capa enviada.
- **Os banners continuam no banco**: são 4, já em WebP no tamanho certo e guardados na CDN ([doc 131](131-banners-mais-leves.md)).

## Testes locais

Sem a chave de verdade, os testes usam uma imitação do Blob que guarda numa pasta (`VIRACAP_BLOB_DE_TESTE`, uma
variável que só existe nos testes). Testado: envio sem e com o Blob (EXIF removido, WebP, larguras), a migração das
antigas, a escolha da largura e do formato no Chrome e no Firefox (computador e celular), a página do mangá, as imagens
dos posts, a mesma imagem duas vezes (sem arquivos novos), apagar mangás (os arquivos só saem quando ninguém mais usa)
e os endereços antigos redirecionando.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_imagens.js` | Novo: preparar (conferir, limpar, larguras, AVIF/WebP, prévia), guardar e apagar no Blob |
| `api/index.js` | Envio de capas e fotos, os dados da capa nas respostas, redirecionamentos e apagar do Blob |
| `api/_comunidade_rotas.js` | Envio das imagens dos posts, as larguras nos posts, a capa copiada para listas, a foto de perfil e apagar |
| `public/app.js` | `imagemResponsiva` (`<picture>`, `srcset`, prévia) nas capas e nas imagens dos posts |
| `public/app.css` | O `<picture>` sem mudar o encaixe das imagens |
| `ferramentas/migrar-imagens-para-blob.mjs` | Novo: leva as imagens que já existem para o Blob |
| `package.json` | `@vercel/blob` 2.8.1 |
| `test-api/imagens.test.mjs` | Novo: larguras, formatos, sem EXIF, prévia, GIF animado e o que não é imagem |

> Os banners e as imagens e vídeos da loja também foram para o Blob: veja [doc 140](140-todas-as-imagens-no-blob.md).
