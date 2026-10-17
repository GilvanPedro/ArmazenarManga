# 63 · Imagens da loja no banco

As imagens das bordas e efeitos que não são feitos só com CSS (molduras desenhadas, animações) passaram a ficar
**no banco de dados**, e não em arquivos do projeto. Feito em outubro de 2026, a pedido do dono do site. A primeira
é a da [borda Celestial](62-borda-celestial-de-imagem.md).

## Como funciona

- Uma tabela nova, `imagens_da_loja`: o nome do arquivo (a chave), o conteúdo, o formato, o tamanho e quando foi
  enviada.
- Cada imagem fica em **`/api/loja/imagens/{nome}`**, que é o endereço que o CSS da borda usa (a Celestial usa
  `url("/api/loja/imagens/celestial.webp")`). Esse endereço é aberto, sem login, porque as capas com borda aparecem
  para qualquer leitor da Comunidade, e a CDN do Vercel guarda a imagem por **uma hora**: trocar uma imagem leva até
  uma hora para aparecer para todo mundo.
- O arquivo `public/bordas/celestial.webp` saiu do projeto.

## A aba "Imagens da loja"

Só para o dono do site, no Gerenciar (`#/gerenciar/imagens`), entre Finanças e Contas:

- **Enviar imagem:** escolher o arquivo (WebP, PNG, inclusive PNG animada, ou GIF, até **3 MB**) e o nome. O nome
  vem do arquivo (em minúsculas, sem acentos, com hífens no lugar de espaços) e pode ser trocado. Enviar com um nome
  que já existe **troca** a imagem.
- **Imagens enviadas:** cada uma com a miniatura (sobre um xadrez, para ver a transparência), o formato, o tamanho,
  a data e o endereço, e o botão **Apagar**.

O servidor confere o formato **pelos primeiros bytes do arquivo**, e não pelo nome: um arquivo que não é WebP, PNG ou
GIF é recusado, e a extensão do nome precisa bater com o formato de verdade (um WebP chamado `x.png` é recusado). O
nome só aceita letras minúsculas, números e hífen, terminando em `.webp`, `.png` ou `.gif`.

## O caminho de uma borda nova feita de imagem

1. O dono manda a imagem.
2. A imagem é conferida, medida (onde a capa fica nela) e convertida para WebP; o CSS da borda é escrito com o
   endereço `/api/loja/imagens/{nome}` e o item entra em `ITENS_DA_LOJA`.
3. O arquivo pronto fica em `Downloads/viracap-loja/` para o dono enviar pela aba "Imagens da loja" do site
   publicado. Até ele ser enviado, a borda aparece sem a moldura.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/loja/imagens/{nome}` | A imagem (sem login; guardada pela CDN por uma hora). 404 se não existe |
| `GET` | `/api/loja/imagens` | Só o dono: a lista `[{ nome, tipo, tamanho, atualizadaEm, endereco }]` |
| `PUT` | `/api/loja/imagens/{nome}` | Só o dono: o corpo é o arquivo, como veio. Envia ou troca |
| `DELETE` | `/api/loja/imagens/{nome}` | Só o dono: apaga |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Tabela `imagens_da_loja`, conferência do formato e do nome, as rotas |
| `public/app.js` | A aba "Imagens da loja" do Gerenciar |
| `public/app.css` | A Celestial lendo a imagem do banco; estilo da aba |
| `public/bordas/celestial.webp` | Apagado (agora fica no banco) |
| `test-api/loja.test.mjs` | Teste do formato pelos bytes e das regras do nome |

## Como foi testado

- Os 86 testes da versão JavaScript passam (1 novo).
- Num banco local, pela aba: antes de enviar, `/api/loja/imagens/celestial.webp` dava 404; ao escolher o arquivo, o
  nome veio `celestial.webp`; depois de enviar, a imagem apareceu na lista e o endereço passou a responder (sem
  login) com `image/webp` e o cache de uma hora, e a borda Celestial da loja passou a mostrar a moldura vinda do
  banco. Um WebP com o nome `teste.png` foi recusado. Uma conta que não é a do dono recebeu 403 ao enviar e ao listar.
