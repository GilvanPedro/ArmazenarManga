# 67 · Temas do site

A loja (veja [Loja de bordas e mochila](57-loja-de-bordas.md)) passou a ter **temas para o site todo**, feitos em
outubro de 2026. Cada pessoa escolhe o tema dela; ele vale só para quem equipou.

## Os temas

**De graça** (toda conta tem, na mochila):

| Id | Nome | Como é |
|----|------|--------|
| (nenhum) | Automático | O de sempre: segue o aparelho (escuro, ou claro se o sistema estiver no modo claro) |
| `escuro` | Escuro | O tema escuro de sempre, mesmo com o sistema no modo claro |
| `claro` | Claro | O tema claro, mesmo com o sistema no modo escuro |

**De cor, R$ 5,00:**

| Id | Nome | Como é |
|----|------|--------|
| `verde` | Verde pastel | Claro, em tons de verde-menta |
| `rosa` | Rosa pastel | Rosa e lilás claros em degradê, com os painéis **meio transparentes** |
| `vermelho` | Vermelho | Escuro, com detalhes em vermelho intenso |
| `roxo` | Roxo | Escuro, em tons de roxo e lavanda |
| `cinza` | Degradê cinza | Grafite em degradê, com os painéis meio transparentes e detalhes em prata |

**De fundo animado, R$ 7,50:**

| Id | Nome | Como é |
|----|------|--------|
| `aurora` | Aurora | Luzes verdes, azuis e roxas se mexendo devagar no escuro |
| `estrelas` | Noite estrelada | Um céu noturno com dois grupos de estrelas piscando fora de tempo |
| `petalas` | Sakura ao vento | Pétalas de cerejeira caindo e indo para o lado, sobre um rosa bem claro |
| `synthwave` | Synthwave | Um sol retrô listrado no horizonte e uma grade neon vindo na direção de quem olha |

O id do Sakura ao vento é `petalas` porque `sakura` já é o id da borda Sakura (a mochila guarda os itens pelo id, e
um id não pode servir para dois itens; os testes conferem isso).

## Na loja

- A loja ganhou a aba **Temas** (`#/loja/temas`), entre Efeitos e Mochila. Cada tema aparece numa **prévia**: uma
  janelinha do site (o topo, quatro capas, um cartão e um botão) com as cores e, nos animados, o fundo animado dele.
  O rótulo diz "Tema" ou "Tema animado".
- Na **mochila**, aparecem Automático, Escuro e Claro (de graça) e os temas comprados. Um tema, uma borda e um efeito
  ficam equipados ao mesmo tempo.
- Na página do Mercado Pago o item aparece como "Tema {nome} - Viracap". O dono do site tem todos (veja
  [O dono tem todos os itens da loja](61-dono-tem-todos-os-itens.md)).

## Como funciona

- O tema equipado fica na conta (`contas.tema`) e chega com a sessão (`conta.tema`). O site o põe em
  `<html data-tema="...">`; sem tema, o atributo some e vale o de sempre (que segue o sistema).
- O tema também fica **guardado no navegador** (`localStorage`), e o site o aplica antes de qualquer coisa ao abrir:
  a página já abre com ele, sem piscar com o tema de sempre. Ao sair da conta, volta o de sempre.
- No `app.css`, cada tema troca as mesmas variáveis de cor do `:root` (fundo, superfícies, borda, texto, destaque,
  perigo, sombra) e, nos temas claros ou escuros, as cores dos status e dos gráficos e o `color-scheme` (para os
  campos e a barra de rolagem acompanharem). Os temas com degradê usam `--fundo-imagem`, parado na tela.
- Os temas animados têm uma ou duas camadas (`body::before` e `body::after`) paradas na tela, atrás de tudo e sem
  pegar cliques. As animações usam movimento e transparência das camadas, que o navegador faz sem redesenhar a
  página. Quem pede para o sistema reduzir animações vê o fundo parado.
- As mesmas regras valem para as prévias (`.previa-do-tema[data-tema="..."]`), então a prévia e o tema de verdade
  nunca ficam diferentes.

## API

| Método | Rota | O que mudou |
|--------|------|-------------|
| `GET` | `/api/loja` | Os temas entre os itens (`tipo: 'tema'`, `animado` nos de fundo animado); `gratis` com o Escuro e o Claro; `equipados.tema` |
| `PUT` | `/api/loja/equipar` | `{ item: 'escuro' }` ou `'claro'` qualquer conta equipa; `{ tipo: 'tema', item: null }` volta ao Automático |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os 9 temas (R$ 5,00 e R$ 7,50), os 2 de graça, a coluna `contas.tema` e equipar um tema |
| `api/index.js` | O tema na sessão |
| `public/app.js` | `aplicarTema` (e o tema guardado ao abrir), a aba Temas, as prévias e os de graça na mochila |
| `public/app.css` | As cores de cada tema, os fundos animados e as prévias |
| `test-api/loja.test.mjs` | Os preços dos temas, os de graça fora da loja e nenhum id repetido entre todos os itens |

## Como foi testado

- Os 87 testes da versão JavaScript passam (1 novo, que pegou o id `sakura` repetido).
- No navegador, com a conta de exemplo: a aba Temas com as 9 prévias; equipar cada tema e abrir a Biblioteca ou a
  Comunidade com ele (Claro, Verde pastel, Rosa pastel, Vermelho, Roxo, Degradê cinza, Aurora, Noite estrelada,
  Sakura ao vento e Synthwave); o tema guardado no navegador; e o Automático tirando o atributo. No celular (390 px),
  com Sakura ao vento, Synthwave, Aurora e Claro, sem rolagem para o lado.

> Depois, entraram os temas animados Galáxia e Fazenda: veja [Temas animados Galáxia e Fazenda](69-temas-galaxia-e-fazenda.md).

> Depois, entrou o tema Silhueta (de imagem, do banco) e as regras dos temas passaram a valer para qualquer elemento
> com `data-tema`: veja [Tema Silhueta e o tema no perfil](70-tema-silhueta-e-tema-no-perfil.md).

> Depois vieram os temas Entardecer, Festival de Verão e Página de Mangá: veja [Temas Entardecer, Festival de Verão e Página de Mangá](87-temas-entardecer-festival-e-pagina-de-manga.md).

> Depois, os temas animados ficaram mais rápidos e ganharam camadas novas: veja [Temas animados mais vivos](90-temas-animados-mais-vivos.md).
