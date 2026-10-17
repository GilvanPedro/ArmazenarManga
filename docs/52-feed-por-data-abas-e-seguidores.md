# 52 · Feed por data, abas ao lado da busca e lista de seguidores

Três ajustes na Comunidade feitos em outubro de 2026 (veja [Comunidade](28-comunidade.md) e
[Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md)).

## "Para você" do mais novo para o mais antigo

**Antes:** o "Para você" era ordenado por pontos (proximidade, interesse e tempo), e um post mais antigo podia
aparecer em cima de um mais novo. A [doc 51](51-sugestoes-e-ordem-do-feed.md) já tinha feito os **seus** posts
subirem, mas posts dos outros continuavam fora da ordem de data.

**Agora:** os posts aparecem **sempre do mais novo para o mais antigo**, sejam seus ou de outra pessoa. Os pontos
continuam existindo, mas só **escolhem quais posts entram** no feed (os 300 mais relevantes entre os 1000 mais
novos); a ordem na tela é a da data. Posts publicados no mesmo instante ficam pela ordem do id, como no banco.

- A regra da doc 51 (`meusPostsAcimaDosMaisAntigos`) saiu: com a ordem por data, ela não tem mais o que fazer.
- O aviso "N posts novos" continua igual. Ao clicar, o feed abre de novo e os novos ficam no topo por serem os mais
  recentes; o parâmetro `novosDesde` do feed deixou de ser usado e é ignorado se chegar.
- O "Seguindo", o perfil e a busca já eram por data e não mudaram.

## Abas ao lado da barra de pesquisa

As abas **Para você** e **Seguindo** ficam na **mesma linha** da barra de pesquisa: as abas à esquerda e a barra à
direita (até 380 px), com a linha de baixo das abas atravessando as duas. O campo de escrever post vem logo abaixo.
Quando não cabem as duas lado a lado (até 560 px de largura, no celular), a barra fica em cima, ocupando a largura
toda, e as abas logo embaixo dela.

## Quem segue e quem é seguido

No perfil de qualquer pessoa (inclusive o seu), os números **seguidores** e **seguindo** viraram botões:

- clicar em **seguidores** abre uma janela "Seguidores de *nick*" com quem segue a pessoa;
- clicar em **seguindo** abre "*nick* segue" com quem ela segue.

Cada pessoa da lista aparece como na busca (foto, nick e descrição, ou o número de seguidores) com o botão
**Seguir** de quem está vendo (menos para você mesmo). Quem seguiu por último aparece primeiro, até 500 pessoas.
Clicar numa pessoa fecha a janela e abre o perfil dela. Se você seguir ou deixar de seguir alguém na janela, os
números do perfil são atualizados quando ela fecha. Com a lista vazia, aparece "Ninguém segue *nick* ainda." ou
"*nick* ainda não segue ninguém." (no seu perfil, "você").

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/contas/{id}/seguidores` | Quem segue a conta: `[{ id, nick, foto, descricao, seguidores, sigo, euMesmo }]`, até 500 |
| `GET` | `/api/comunidade/contas/{id}/seguindo` | Quem a conta segue, no mesmo formato |

As duas pedem login, como o resto da Comunidade. A versão Java não tem Comunidade e não mudou.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade.js` | `doMaisNovoParaOMaisAntigo` no lugar de `meusPostsAcimaDosMaisAntigos` |
| `api/_comunidade_rotas.js` | O "Para você" sai por data; rotas `seguidores` e `seguindo` |
| `public/app.js` | Abas e barra de pesquisa na mesma linha; `linhaDePessoa` (usada na busca e nas listas); janela de seguidores e seguindo; o aviso de posts novos só reabre o feed |
| `public/app.css` | Linha das abas com a busca; números clicáveis; janela da lista |
| `test-api/comunidade.test.mjs` | Teste da ordem por data no lugar do teste da regra antiga |

## Como foi testado

- Os 71 testes da versão JavaScript passam.
- Num banco local com quatro contas: a Ana postou, depois a Bia, a Ana de novo e o Caio. O "Para você" da Bia
  mostrou os quatro do mais novo para o mais antigo. As rotas devolveram os seguidores da Ana (Davi, Caio e Bia, do
  último a seguir para o primeiro) e quem ela segue.
- No navegador, no computador (1400 px) e no celular (390 px): abas e busca na mesma linha (no celular, a busca em
  cima das abas); a janela de seguidores abre, mostra o Seguir de cada um, e clicar numa pessoa fecha a janela e abre
  o perfil dela.
