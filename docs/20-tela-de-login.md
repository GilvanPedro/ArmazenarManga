# 20 · Tela de login de 30 dias

Mudança feita em outubro de 2026: o login deixou de ser a janela de senha do navegador e passou a ser uma tela
do próprio site, que mantém a pessoa conectada por 30 dias e tem um botão de sair.

## O que motivou

- O login era o HTTP Basic: a janela cinza do navegador. Ela não tem visual próprio e não tem como sair.
- O navegador esquece essa senha ao ser fechado, então era preciso entrar de novo a cada vez que o computador
  era ligado.

## Como funciona agora

- Ao abrir o site sem estar conectado, aparece a **tela de entrada**: logo, nome do site, usuário, senha (com
  botão "Mostrar"), botão "Entrar" e o aviso de que o login dura 30 dias.
- Depois de entrar, o login vale por **30 dias contados a partir do momento em que se entrou**, neste navegador.
  Fechar o navegador ou desligar o computador não desconecta. Passados os 30 dias, a tela de entrada aparece de
  novo. Usar o site nesse período não estende o prazo: a regra é sair no máximo uma vez por mês.
- O botão **Sair**, no topo, desconecta este navegador e volta à tela de entrada.
- Se o login vencer com o site aberto, a próxima ação mostra a tela de entrada com o aviso "Seu login venceu".
- Ao entrar, o site abre na tela que estava no endereço. Assim o favorito e a extensão de "marcar como lido"
  continuam levando à tela de confirmação, mesmo quando é preciso entrar antes.
- O usuário digitado fica lembrado neste navegador; a senha, não. O formulário segue o padrão que os
  gerenciadores de senha reconhecem.

O usuário e a senha continuam sendo os das variáveis `MANGATRACKER_USUARIO` (padrão `manga`) e
`MANGATRACKER_SENHA`. Nada precisa ser configurado de novo no Vercel ou no Render.

## Como o login é guardado

O login fica em um cookie chamado `mangas_sessao`, com:

- **HttpOnly**: os scripts da página não conseguem ler o cookie;
- **SameSite=Lax**: outros sites não conseguem usá-lo para alterar dados;
- **Secure** quando o site é aberto por https (no Vercel, sempre);
- validade de 30 dias (`Max-Age=2592000`).

O conteúdo do cookie é `v1.{data de vencimento}.{número aleatório}.{assinatura}`. A assinatura é um HMAC-SHA256
feito com um **segredo** que só o servidor tem e que também depende do usuário e da senha. Por isso:

- um cookie alterado ou inventado é recusado;
- não é preciso guardar as sessões no banco: o próprio cookie prova que é válido;
- **trocar a senha desfaz todos os logins**, em qualquer aparelho.

### O segredo

O segredo é criado sozinho na primeira vez, com 32 bytes aleatórios, e guardado junto dos dados:

- com banco: na tabela `configuracoes`, linha `segredo-da-sessao`. A versão Java e a do Vercel leem o mesmo, e as
  duas assinam do mesmo jeito; um login feito em uma vale na outra;
- sem banco: no arquivo `segredo-da-sessao`, na pasta de dados, legível só pelo dono.

Quem preferir pode definir o segredo na variável `MANGATRACKER_SEGREDO` (32 caracteres ou mais). Apagar ou trocar
o segredo também desfaz todos os logins.

## Proteção contra quem tenta adivinhar a senha

Depois de **10 tentativas erradas em 15 minutos**, novos logins esperam até a janela passar ("Muitas tentativas
erradas. Tente de novo em N minutos"). O limite vale para o site inteiro, e não por endereço de quem tenta,
porque esse endereço pode ser falsificado atrás da hospedagem. Quem já está conectado não é afetado.

Na versão do Vercel as tentativas ficam na tabela `tentativas_de_login`, porque cada chamada pode cair em uma
cópia diferente da função. Na versão Java ficam na memória.

As comparações de usuário e senha levam o mesmo tempo seja qual for o erro, para o tempo de resposta não dar
pistas. A rota de entrar também recusa chamadas vindas de outros sites.

## O que mudou no servidor

| Rota | O que faz |
|------|-----------|
| `GET /api/sessao` | Diz se o site pede login e se este navegador está conectado: `{exigeLogin, logado, usuario, expiraEm}` |
| `POST /api/sessao` | Entra: `{"usuario": "...", "senha": "..."}`. Grava o cookie e responde como o GET |
| `DELETE /api/sessao` | Sai: apaga o cookie deste navegador |

- As rotas em `/api/` pedem o cookie; sem ele respondem `401` com "Entre com seu usuário e senha", sem a janela de
  senha do navegador.
- A senha pelo HTTP Basic **não é mais aceita**.
- Os arquivos do site (HTML, CSS, JavaScript e ícones) passaram a abrir sem login, para a tela de entrada poder
  aparecer. Eles não têm nenhum dado da lista. Na versão do Vercel isso já era assim. As capas enviadas, que
  ficam em `/api/imagens`, continuam pedindo login.
- Sem senha configurada (uso só no próprio computador, versão Java), continua não havendo login, e o botão Sair
  não aparece.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `web/Sessoes.java` | Novo: cria e confere o cookie de login |
| `web/LimiteDeTentativas.java` | Novo: limite de tentativas erradas |
| `repository/SegredoDaSessao.java` | Novo: cria e guarda o segredo, no banco ou em arquivo |
| `web/ApiServer.java` | Rotas de `/api/sessao` e o cookie no lugar do HTTP Basic |
| `App.java` | Lê ou cria o segredo ao iniciar |
| `domain/exceptions/PersistenciaException.java` | Construtor só com a mensagem |
| `api/_sessao.js` | Novo: o mesmo cookie, na versão JavaScript |
| `api/index.js` | Rotas de `/api/sessao`, segredo e tentativas no banco |
| `public/index.html` | Botão Sair no topo |
| `public/app.js`, `public/app.css` | Tela de entrada, sair e volta à tela quando o login vence |

## Testes

- Java (272 no total, 12 a mais): cookie válido, vencido, alterado, de outro segredo e de outra senha; validade
  máxima de 30 dias; o mesmo exemplo de cookie que a versão JavaScript; o limite de tentativas; o segredo em
  arquivo e no banco; e as rotas: entrar, sair, sem login, login errado, freio depois de 10 erros, login de outro
  site, login que continua depois de reiniciar e que acaba ao trocar a senha.
- JavaScript (52 no total, 5 a mais): o mesmo para o cookie, mais leitura do cabeçalho e o segredo da variável.
- A versão do Vercel foi conferida à mão contra um banco Postgres local: entrar, sair, sessão, cookie alterado,
  login de outro site, segredo gravado no banco e o freio depois de 10 erros.
- A tela foi conferida em um navegador: tema escuro e claro, celular, senha errada, mostrar senha, entrar e cair
  na tela do endereço, fechar e reabrir o navegador continuando conectado, sair e login vencido no meio do uso.

## O que ficou de fora

- **Sair de todos os aparelhos** por um botão. Hoje isso se faz trocando a senha.
- Lista de aparelhos conectados.
- Recuperar a senha esquecida: a senha está nas variáveis de ambiente da hospedagem.
