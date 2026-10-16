# 51 · Sugestões na busca, seus posts no topo e limite de cadastro

Três ajustes feitos em outubro de 2026, dois na Comunidade (veja [Comunidade](28-comunidade.md) e
[Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md)) e um nas contas.

## Sugestões enquanto se digita

A barra de pesquisa em cima do campo de escrever sugere **até 3 itens** enquanto se digita, nesta ordem de
prioridade:

1. **pessoas** pelo nick (o nick exato primeiro, depois os que começam com o texto);
2. **#tags** que começam com o texto, das mais usadas para as menos usadas entre os 1000 posts mais recentes que têm
   aquele trecho (cada post conta uma vez por tag);
3. **posts** que têm o texto, os mais novos primeiro.

Os espaços que sobram vão para o próximo tipo: sem pessoas com aquele nick, aparecem mais tags ou posts. Começando
com `#`, só tags e posts; com `@`, igual ao texto puro.

- Clicar numa pessoa abre o perfil; numa tag, a busca dela; num post, o post (e o ← volta ao feed no mesmo ponto).
- Pelo teclado: ↓ e ↑ escolhem (passando do último, volta para o campo), Enter abre o escolhido e Esc fecha. Enter
  sem nada escolhido faz a busca completa, como antes.
- A lista segue o padrão de caixa com sugestões (`combobox`): o leitor de tela anuncia o item escolhido.
- A sugestão espera 180 ms depois da última tecla, e uma resposta atrasada não substitui a mais nova.

## Seus posts no topo do "Para você"

**O problema:** depois de recarregar a página, ou de entrar numa `#tag` e voltar, posts mais antigos de outras pessoas
apareciam em cima de posts recentes seus. O feed é ordenado por pontos (veja a fórmula em [Comunidade](28-comunidade.md)),
e os seus posts ganham proximidade 5. Um post antigo de alguém que você segue começa com 10 de proximidade, e com
curtidas passava o seu. Logo depois de publicar, o site põe o post no topo na hora; ao recarregar, a ordem era
calculada de novo e ele descia.

**A regra nova:** no "Para você", um post seu **nunca fica embaixo de um post mais antigo de outra pessoa**. Depois da
ordem por pontos, cada post seu sobe (nunca desce) até ficar acima do primeiro post de outra pessoa que seja mais
antigo que ele. Posts dos outros **mais novos** que o seu continuam podendo vir antes, se tiverem mais pontos, e um
post seu que já estava bem colocado não sai do lugar. Entre os seus, o mais novo fica antes. O "Seguindo" e o perfil
já eram do mais novo para o mais antigo e não mudaram.

## Limite de cadastro

O limite de contas criadas no site inteiro passou de **20 por hora** para **20 em 10 minutos**, nas duas versões
(Vercel e Java). Os outros limites (senha errada) continuam iguais; veja [Contas de usuário](23-contas.md).

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/busca-rapida?q=` | Até 3 sugestões: `{ tipo: 'pessoa', id, nick, foto }`, `{ tipo: 'hashtag', tag, posts }` ou `{ tipo: 'post', id, texto, autor }` |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade.js` | `hashtagsQueComecamCom` e `meusPostsAcimaDosMaisAntigos` |
| `api/_comunidade_rotas.js` | Rota `busca-rapida`; o "Para você" aplica a regra dos seus posts |
| `api/index.js` | Limite de cadastro: 20 em 10 minutos |
| `ContaService.java` | O mesmo limite na versão Java |
| `public/app.js` | A barra de pesquisa ganhou a lista de sugestões, com teclado e mouse |
| `public/app.css` | Estilo da lista de sugestões |
| `test-api/comunidade.test.mjs` | Testes das tags sugeridas e da ordem dos seus posts |

## Testes

- `npm test`: 71 testes passando (2 novos). Os testes da versão Java continuam passando.
- No navegador:
  - "fri…" sugere a pessoa e depois as duas tags;
  - "#fri…" sugere as tags e depois um post, e "@fri…" põe a pessoa primeiro;
  - ↓↓ + Enter abre a tag escolhida;
  - clicar na pessoa abre o perfil, e clicar no post abre o post com o ← funcionando;
  - Esc fecha, e Enter sem escolher faz a busca completa;
  - no celular, sem rolagem para o lado.
- O caso relatado, refeito no navegador: o post antigo do Caio (seguido e curtido, cerca de 3,8 pontos) ficava acima
  do meu post novo (cerca de 2,6). Agora o meu fica em cima ao abrir, ao recarregar e ao entrar numa #tag e voltar. Um
  post da Bia mais novo que o meu continua podendo vir antes.
