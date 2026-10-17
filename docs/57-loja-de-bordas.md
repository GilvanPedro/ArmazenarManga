# 57 · Loja de bordas e mochila

A primeira coisa paga do Viracap, feita em outubro de 2026: **bordas para as capas dos mangás favoritos**, vendidas
por **R$ 4,50** cada, com dinheiro de verdade, pelo **Mercado Pago** (Pix ou cartão). O que a pessoa compra fica na
**mochila**, e ela escolhe qual borda equipar.

## Para quem usa

- A **Loja** é uma aba nova da Biblioteca (`#/loja`), ao lado de "Extensão e atalho". Mostra cada borda numa capa de
  exemplo (a de um favorito da pessoa, se ela tiver; se não, uma capa desenhada), com o nome, a descrição e o botão
  **Comprar por R$ 4,50**. As que a pessoa já tem aparecem com "Na mochila" e o botão Equipar.
- A **Mochila** (`#/loja/mochila`) mostra as bordas compradas e a **Roxa**, a borda de sempre, que vem com toda conta.
  Só uma fica equipada; "Tirar" volta para a Roxa.
- A borda equipada aparece nas capas dos **favoritos** (as que já tinham a moldura roxa e a estrela): na Biblioteca,
  na página do mangá e nas **listas publicadas na Comunidade** (quem vê a lista vê a borda de quem publicou).
- A loja só existe na versão do Vercel (a mesma que tem a Comunidade).

### As bordas

| Id | Nome | Como é |
|----|------|--------|
| `dourada` | Ouro Lendário | Moldura de ouro polido, com um reflexo que passa de tempos em tempos; estrela dourada |
| `neon` | Neon | Ciano e rosa andando pela borda, com um brilho que pulsa em volta |
| `sakura` | Sakura | Rosa das cerejeiras, com pétalas caindo sobre a capa e uma flor no lugar da estrela |
| `chamas` | Chamas | Fogo do vermelho ao amarelo subindo pela borda, com brilho laranja |
| `galaxia` | Galáxia | Azul e roxo do espaço com estrelinhas na moldura e um brilho que pisca |

Quem pede para o sistema reduzir animações vê as bordas paradas. Para criar outra borda: um item novo em
`ITENS_DA_LOJA` (`api/_loja.js`) e a classe `borda-{id}` no `app.css`.

## Como a compra funciona

1. **Comprar.** O site chama `POST /api/loja/comprar`. O servidor cria a compra (`pendente`) com o preço dele (o
   navegador não manda preço) e pede ao Mercado Pago uma preferência de pagamento (Checkout Pro), com o id da compra
   como `external_reference`. A pessoa vai para a página do Mercado Pago e paga por Pix ou cartão. O Viracap nunca
   vê os dados do cartão.
2. **Aviso do Mercado Pago.** Quando o pagamento muda, o Mercado Pago chama `POST /api/loja/webhook`. O servidor
   confere a **assinatura** do aviso e **busca o pagamento na API do Mercado Pago** com o token secreto. A borda só
   entra na mochila se o pagamento estiver **aprovado**, com **R$ 4,50** e em **reais**.
3. **Volta para o site.** O Mercado Pago traz a pessoa para `/api/loja/retorno`, que manda para `#/loja`. O site
   mostra "Confirmando o pagamento…" e pergunta a cada 3 segundos (até 2 minutos) a `GET /api/loja/compras/{id}`, que
   também confere no Mercado Pago. Assim a borda aparece mesmo se o aviso atrasar. Aprovado: "Pagamento aprovado!"
   com o botão **Equipar agora**. Recusado: "O pagamento não foi aprovado" (nada é cobrado). Pix ainda não pago: o
   aviso diz que a borda aparece sozinha quando o Mercado Pago confirmar.
4. **Reembolso ou estorno.** Se você devolver o dinheiro pelo painel do Mercado Pago (ou houver estorno no cartão), o
   aviso chega e a borda **sai da mochila** (e, se estava equipada, volta a Roxa).

Proteções: preço só no servidor; pagamento com valor ou moeda diferentes fica como `divergente` e não entrega nada;
o aviso só muda a compra depois de buscado na API (um aviso falso não faz nada, e sem a assinatura certa é recusado);
o mesmo aviso repetido não entrega duas vezes; não dá para comprar a mesma borda de novo nem equipar uma que não tem;
no máximo 10 compras começadas por hora por conta; a preferência de pagamento vence em 24 horas.

## O que você precisa fazer para começar a vender

Sem as variáveis abaixo, a loja aparece, mas o botão de comprar fica desligado e um aviso diz que ela ainda não
está recebendo pagamentos.

1. **Conta no Mercado Pago.** Crie (ou use) uma conta em mercadopago.com.br com o seu CPF. É nela que o dinheiro
   cai; dela você transfere para o seu banco.
2. **Aplicação.** Em mercadopago.com.br/developers/panel, clique em **Criar aplicação**, escolha **Pagamentos
   online** e o produto **Checkout Pro**.
3. **Testar primeiro.** Em **Credenciais de teste**, copie o **Access Token** (começa com `TEST-`). No Vercel, em
   *Settings > Environment Variables*, crie `MERCADOPAGO_ACCESS_TOKEN` com ele.
4. **Avisos (Webhooks).** Na aplicação, em **Webhooks > Configurar notificações**, ponha a URL
   `https://viracap.vercel.app/api/loja/webhook`, marque o evento **Pagamentos** e salve. Copie a **assinatura
   secreta** que aparece e crie no Vercel `MERCADOPAGO_WEBHOOK_SECRET` com ela.
5. **Publique de novo** no Vercel (as variáveis só valem depois de uma nova publicação) e faça uma compra de teste
   com as **contas de teste** e os **cartões de teste** do painel do Mercado Pago.
6. **Valer de verdade.** Em **Credenciais de produção**, ative as credenciais (o Mercado Pago pede alguns dados) e
   troque `MERCADOPAGO_ACCESS_TOKEN` pelo token de produção (começa com `APP_USR-`). Confira se a assinatura secreta
   dos Webhooks de produção é a mesma que está no Vercel. Publique de novo.

O Mercado Pago cobra uma taxa por venda, diferente para Pix e cartão (veja os valores no painel dele). Os tokens e a
assinatura nunca vão para o código nem para o chat: só nas variáveis do Vercel.

| Variável | Para que serve |
|----------|----------------|
| `MERCADOPAGO_ACCESS_TOKEN` | Obrigatória para vender. Cria os pagamentos e confere cada um na API |
| `MERCADOPAGO_WEBHOOK_SECRET` | Recomendada. Recusa avisos que não vieram do Mercado Pago |
| `MANGATRACKER_SITE` | Opcional. O endereço do site para as voltas e os avisos (sem ela, o endereço de quem acessa) |
| `MERCADOPAGO_API` | Só para testes: outro endereço no lugar da API do Mercado Pago |

**Direitos do comprador.** Pelo Código de Defesa do Consumidor, quem compra pela internet pode desistir em até 7
dias. Para devolver, faça o reembolso pelo painel do Mercado Pago: a borda sai da mochila sozinha.

## O que é guardado

| Tabela ou coluna | O que tem |
|------------------|-----------|
| `compras` | Cada compra: conta, item, preço em centavos, status (`pendente`, `aprovada`, `recusada`, `reembolsada`, `divergente`), o número do pagamento no Mercado Pago e as datas |
| `mochila` | As bordas de cada conta (e de qual compra vieram) |
| `contas.borda` | A borda equipada (vazia: a Roxa) |

Nada de cartão, CPF ou dados do pagador: isso fica só no Mercado Pago.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/loja` | `{ itens, mochila: [{ item, obtidoEm }], equipada, pagamentoConfigurado }` |
| `POST` | `/api/loja/comprar` | `{ item }` → `{ compra, endereco }` (o endereço do pagamento no Mercado Pago). 409 se já tem, 503 sem o token |
| `GET` | `/api/loja/compras/{id}` | `{ compra, item, status }`; pendente, confere no Mercado Pago |
| `PUT` | `/api/loja/equipar` | `{ item }` (ou `{ item: null }` para a Roxa) → `{ equipada }`. 403 se não tem |
| `POST` | `/api/loja/webhook` | O aviso do Mercado Pago (sem login, com assinatura) |
| `GET` | `/api/loja/retorno?compra=` | A volta do Mercado Pago: redireciona para `#/loja?compra=` |

A sessão (`/api/inicio`, `/api/sessao`) passou a trazer `conta.borda`, e o autor de cada post da Comunidade, `borda`.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Novo: itens, tabelas, Mercado Pago, assinatura, compra, conferência, aviso e equipar |
| `api/index.js` | Rotas da loja (aviso e volta sem login); tabelas; `borda` na conta |
| `api/_comunidade_rotas.js` | A borda do autor nos posts |
| `public/app.js` | Aba Loja, telas da loja e da mochila, acompanhamento da compra, borda nas capas dos favoritos |
| `public/app.css` | As cinco bordas e as telas da loja |
| `test-api/loja.test.mjs` | Novo: itens, assinatura, o que cada pagamento faz e as mudanças de status |

## Como foi testado

- Os 79 testes da versão JavaScript passam (4 novos).
- De ponta a ponta, num banco local, com um **Mercado Pago de mentira** (as mesmas rotas e o mesmo aviso assinado):
  - cartão aprovado: a borda entrou na mochila, "Equipar agora" equipou e as capas dos favoritos na Biblioteca
    ficaram com a classe `borda-dourada`;
  - Pix: "Confirmando o pagamento…" até o Pix ser pago; depois, aprovado sem recarregar;
  - pagamento de 1 centavo aprovado: não entregou ("Houve um problema com essa compra");
  - recusado: "O pagamento não foi aprovado", sem borda;
  - reembolso: a borda saiu da mochila e deixou de estar equipada;
  - aviso sem assinatura: recusado (401); comprar de novo o que já tem: 409; equipar sem ter: 403.
- No navegador, no computador (tema escuro) e no celular (390 px, tema claro), sem rolagem para o lado.
- **Não testado com o Mercado Pago de verdade**: falta a conta e as credenciais. Faça o passo 5 acima antes de
  passar para produção.

> Depois, as vendas da loja passaram a aparecer na aba Finanças do Gerenciar, com o histórico de cada mês: veja
> [Finanças: ganho e perda do site](58-financas.md).

> Depois, a loja ganhou os efeitos (R$ 2,50), foi para o topo ao lado da Comunidade e passou a ter as abas Bordas,
> Efeitos e Mochila, com páginas: veja [Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md).

> Depois, a loja ganhou mais sete bordas, com enfeites que saem da capa: veja [Bordas ornamentadas](60-bordas-ornamentadas.md).

> Depois, a conta do dono do site passou a ter todos os itens sem comprar: veja
> [O dono tem todos os itens da loja](61-dono-tem-todos-os-itens.md).

> Depois, a loja ganhou temas para o site todo (aba Temas): veja [Temas do site](67-temas-do-site.md).
