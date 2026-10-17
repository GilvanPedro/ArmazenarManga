# 59 · Efeitos dos favoritos, a Loja no topo e o painel só do dono

Quatro ajustes feitos em outubro de 2026, na loja (veja [Loja de bordas e mochila](57-loja-de-bordas.md)) e no
Gerenciar (veja [Painel dos administradores](56-painel-dos-administradores.md) e [Finanças](58-financas.md)).

## Efeitos para os favoritos

Além das bordas, a loja passou a vender **efeitos** para as capas dos favoritos, a **R$ 2,50** cada. O **Brilho** (o
reflexo que já passava pela capa) é o efeito de sempre: vem com todas as contas e não se vende.

| Id | Nome | Como é |
|----|------|--------|
| `holografico` | Holográfico | Um reflexo de arco-íris que atravessa a capa, como uma carta rara |
| `faiscas` | Faíscas | Estrelinhas que acendem e apagam em cima da capa (a estrela do favorito também brilha) |
| `neve` | Neve | Flocos de neve caindo devagar |
| `raios` | Raios | Clarões elétricos azuis que piscam nas bordas e riscam a capa |
| `aura` | Aura | Uma luz que pulsa de dentro da capa, passando de rosa a azul e a verde |

- Uma **borda e um efeito** ficam equipados ao mesmo tempo: os dois aparecem juntos (por exemplo, Neon com
  Holográfico). O efeito é uma camada própria por cima da imagem (`::before`), então combina com qualquer borda.
- Com um efeito equipado, o Brilho sai; a borda Sakura continua com as pétalas dela.
- Os selos da capa (status, nota e a estrela) ficam por cima do efeito.
- Quem pede para o sistema reduzir animações vê os efeitos parados.
- A compra é igual à das bordas: Mercado Pago, aviso conferido na API, reembolso tira o efeito da mochila (e de cima
  das capas, se estava equipado). Na página do Mercado Pago o item aparece como "Efeito {nome} - Viracap".
- Assim como a borda, o efeito de quem publica uma lista na Comunidade aparece nas capas dos favoritos da lista.

## A Loja ao lado da Comunidade

A Loja saiu das abas da Biblioteca e foi para o **topo**, entre Comunidade e Gerenciar: **Biblioteca · Comunidade ·
Loja · Gerenciar**. Só aparece na versão do Vercel (a mesma que tem a Comunidade). No celular, os quatro botões ficam
mais estreitos para caberem na mesma linha.

## A loja centralizada e com páginas

- O título, o texto e as abas ficam no meio, e a página tem até 1180 px de largura, centralizada.
- Três abas: **Bordas** (`#/loja/bordas`), **Efeitos** (`#/loja/efeitos`) e **Mochila** (`#/loja/mochila`).
  `#/loja` abre as bordas.
- Os itens ficam em **até 5 colunas** e cada página tem **até 6 linhas (30 itens)**. Com mais que isso, aparecem
  "‹ Anterior", "Página N de M" e "Próxima ›", e a página fica no endereço (`?pagina=2`). Uma linha com menos itens
  fica centralizada. Em telas menores, 4, 3 ou 2 colunas.
- Cada cartão diz se é **Borda** ou **Efeito**. A mochila mostra a Roxa e o Brilho (os de sempre) e tudo o que a
  pessoa comprou; o que está equipado aparece com "✓ Equipado".

## Painel e Finanças só para o dono

O **Painel** e as **Finanças** do Gerenciar passaram a ser só do dono do site. Os outros admins continuam com
**Contas** e **Registro** (a moderação) e não veem as duas abas; as rotas `gerenciamento/painel` e
`gerenciamento/financas` respondem 403 para eles.

- Para o dono, o Gerenciar abre no Painel (`#/gerenciar` ou `#/gerenciar/painel`); para os outros admins, em Contas.
- **Quem é o dono:** o e-mail do dono está no código só como **hash SHA-256** (o repositório é público, então o
  e-mail não fica escrito nele). A variável `MANGATRACKER_DONO_EMAIL` (e-mails separados por vírgula), se existir,
  vale no lugar dele.
- O dono é **sempre admin**, mesmo sem estar em `MANGATRACKER_ADMIN_EMAIL`.
- A sessão (`/api/inicio`, `/api/sessao`) passou a trazer `conta.dono`.

## API

| Método | Rota | O que mudou |
|--------|------|-------------|
| `GET` | `/api/loja` | Os itens têm `tipo` (`borda` ou `efeito`); `equipada` virou `equipados: { borda, efeito }` |
| `PUT` | `/api/loja/equipar` | `{ item }` equipa (no tipo do item); `{ tipo, item: null }` volta à Roxa ou ao Brilho. Devolve `{ equipados }` |
| `GET` | `/api/comunidade/gerenciamento/painel` e `.../financas` | Só o dono; os outros admins recebem 403 |

O histórico de vendas das Finanças passou a trazer o nome do item ("Borda Neon", "Efeito Holográfico").

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os 5 efeitos a R$ 2,50; coluna `contas.efeito`; equipar por tipo; reembolso tira borda ou efeito |
| `api/index.js` | `ehDono` (hash ou `MANGATRACKER_DONO_EMAIL`), o dono sempre admin, `dono` e `efeito` na conta |
| `api/_comunidade_rotas.js` | Painel e finanças só para o dono; o efeito do autor nos posts |
| `api/_financas.js` | O nome do item no histórico de vendas |
| `public/index.html` | Botão Loja no topo |
| `public/app.js` | Loja reescrita (abas Bordas, Efeitos e Mochila, páginas de 30); efeito nas capas; Loja no topo; Gerenciar conforme o dono |
| `public/app.css` | Os 5 efeitos; loja centralizada em até 5 colunas; botões do topo no celular |
| `test-api/loja.test.mjs` | Teste dos efeitos e das colunas de cada tipo |

## Como foi testado

- Os 85 testes da versão JavaScript passam.
- Num banco local, com o Mercado Pago de mentira: comprar o Holográfico (R$ 2,50) foi aprovado, "Equipar agora"
  equipou, e com a borda Neon equipada a capa ficou com `borda-neon efeito-holografico`.
- Páginas: com 2 itens por página (só no teste), as bordas viraram 3 páginas, e "Próxima" levou a
  `#/loja/bordas?pagina=2`.
- Uma admin que não é a dona viu só Contas e Registro, `#/gerenciar/financas` abriu Contas, e as rotas do painel e
  das finanças responderam 403.
- No navegador, no computador (tema escuro) e no celular (390 px, tema claro), sem rolagem para o lado.

> Depois, entraram mais seis efeitos e a mochila ganhou um filtro por tipo: veja
> [Mais efeitos e o filtro da mochila](68-mais-efeitos-e-filtro-da-mochila.md).
