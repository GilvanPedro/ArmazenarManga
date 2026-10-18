# 74 · Curtir sem abrir o post, e botões maiores

Dois ajustes nos posts da Comunidade (veja [Comunidade](28-comunidade.md)), feitos em outubro de 2026.

## Curtir não abre mais o post

**O problema:** no feed, clicar no coração curtia **e** abria o post. Só o comentário devia abrir.

**A causa:** o cartão do post abre o post quando se clica nele, menos quando o clique é num botão, link ou campo. Ele
conferia isso pelo elemento clicado (`evento.target.closest('button')`). Só que o botão de curtir, no clique, troca o
que tem dentro (o coração vazio pelo cheio e o número); quando o clique chegava ao cartão, o elemento clicado (o
coração) já não estava mais na página, então o cartão não achava o botão e abria o post.

**A correção:**

- o cartão passou a conferir o **caminho do clique** de quando ele começou (`evento.composedPath()`), que continua
  tendo o botão mesmo depois de o conteúdo dele mudar;
- e o botão de curtir não deixa o clique chegar ao cartão (`stopPropagation`).

Comentar continua abrindo o post, e clicar no texto ou no espaço do post também.

## Botões maiores

Os botões de **curtir** e **comentar** ficaram maiores e mais fáceis de acertar: texto de 16 px em negrito, ícone de
21 px, pelo menos 42 px de altura (44 px no celular) e mais espaço em volta. O botão de apagar ficou com o ícone um
pouco menor, para não competir com os dois.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | O cartão do post confere o caminho do clique; curtir não deixa o clique chegar ao cartão |
| `public/app.css` | Os botões de curtir e comentar maiores |

## Como foi testado

No navegador, no computador e no celular: clicar bem no coração curtiu (0 → 1) e o endereço continuou
`#/comunidade`; clicar de novo descurtiu sem abrir; o botão de comentar abriu o post. O botão de curtir ficou com
62 × 42 px. Os 88 testes da versão JavaScript passam.
