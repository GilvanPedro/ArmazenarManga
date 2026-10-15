# 23 · Contas de usuário

Mudança feita em outubro de 2026: o site passou a ter **cadastro de contas**. Cada pessoa cria a sua conta com
e-mail, nick e senha, entra com e-mail e senha, e vê só os mangás que ela mesma cadastrou.

Ela completa a preparação descrita em [Escala e preparação para contas](22-escala-e-contas.md), que já tinha
colocado um dono em cada registro.

## Regras

| Campo | Regra |
|-------|-------|
| E-mail | Obrigatório e **único**: só pode existir uma conta por e-mail. É guardado em minúsculas, então `Ana@X.com` e `ana@x.com` são o mesmo |
| Senha | Pelo menos **6 caracteres** (e no máximo 200). Os espaços contam |
| Nick | Obrigatório, até 40 caracteres. Não precisa ser único. Pode ser mudado quando quiser |

## Telas

### Entrar e criar conta

A tela de entrada (a mesma de [Tela de login de 30 dias](20-tela-de-login.md)) agora pede **e-mail e senha** e tem
o link **"Não tem conta? Criar uma"**, que troca para o cadastro: nick, e-mail, senha e a senha repetida. Criar a
conta já entra nela. O login continua valendo 30 dias.

### Topo

Depois de entrar, o topo mostra o **nick** com a inicial em um círculo (no celular, só o círculo) e o botão
**Sair**. Clicar no nick abre a página da conta.

### Minha conta (`#/conta`)

Mostra o nick, o e-mail, quantos mangás a conta tem, a data de criação e o selo **Admin** quando é o caso. Cada
parte se edita separadamente:

| Parte | O que pede |
|-------|------------|
| Nick | Só o nick novo |
| E-mail | O e-mail novo e a **senha atual** |
| Senha | A senha atual, a nova e a nova repetida. Trocar a senha **desconecta os outros aparelhos**; este continua dentro |
| Excluir conta | A senha atual e, depois, a confirmação em uma janela: "A conta … e N mangás serão apagados para sempre. Você tem certeza?" |

Excluir a conta apaga a conta, todos os mangás dela e as capas enviadas. O e-mail fica livre para uma conta nova.

## Os mangás de antes das contas

Os mangás cadastrados antes desta mudança estão na conta antiga (`principal`), que não tem e-mail nem senha.
Para passá-los para uma conta de verdade:

1. Criar a conta normalmente.
2. Em **Minha conta**, aparece a parte **"Mangás de antes das contas"**, com quantos são.
3. Digitar a **senha antiga do site** (a da variável `MANGATRACKER_SENHA`) e clicar em **"Trazer para esta conta"**.

Os mangás e as capas passam para a conta, e ela ganha o selo **Admin**. A parte some depois disso.

**Isso mudou depois:** a parte passou a ser só para admins, sem a senha antiga. Veja
[Mangás antigos só para admins](26-mangas-antigos-so-para-admins.md).

Hoje o selo Admin só marca a conta; ele ainda não dá nenhuma ferramenta a mais.

## Segurança

- **Senhas só como hash.** PBKDF2 com SHA-256, 600 mil iterações e sal aleatório por senha, no formato
  `pbkdf2_sha256$iterações$sal$hash`. A senha nunca é guardada nem devolvida.
- **Cookie por conta.** O cookie de login passou a dizer de qual conta é (`v2.{id da conta}.{validade}.…`) e a
  assinatura depende da senha guardada da conta: trocar a senha invalida os logins dela nos outros aparelhos, e
  excluir a conta invalida todos. Os cookies do login antigo deixaram de valer, então é preciso entrar de novo
  uma vez.
- **Nada vaza entre contas.** Toda consulta filtra pela conta da sessão. Sem login, nenhuma consulta de dados
  encontra nada (a versão do Vercel recusa a consulta; a Java usa uma conta que não existe). Uma conta não abre,
  não edita, não apaga e não usa como capa nada de outra; tudo responde como se não existisse (404).
- **E-mail que não existe e senha errada** dão a mesma resposta ("E-mail ou senha incorretos"), no mesmo tempo:
  não dá para descobrir quais e-mails têm conta pelo login. No cadastro, o e-mail repetido é avisado, porque é
  preciso.
- **Limites de tentativas:**

| O quê | Limite |
|-------|--------|
| Senha errada de um e-mail (login, ou senha atual na conta) | 10 em 15 minutos para aquele e-mail |
| Senha errada no site inteiro | 100 em 15 minutos |
| Contas criadas no site inteiro | 20 por hora |
| Senha antiga errada ao trazer os mangás antigos | 10 em 15 minutos |

  O limite por e-mail não atrapalha as outras contas, e quem já está dentro continua dentro. Na versão do Vercel
  as tentativas ficam no banco (cada chamada pode cair em uma cópia diferente da função); na Java, na memória.
- Criar conta, entrar e todas as alterações continuam recusando chamadas vindas de outros sites.

## O que mudou no servidor

| Método | Rota | O que faz |
|--------|------|-----------|
| `POST` | `/api/contas` | Cria a conta `{email, nick, senha}` e já entra nela (201). E-mail repetido: 409 |
| `POST` | `/api/sessao` | Entra com `{email, senha}` (antes era `usuario`) |
| `GET` | `/api/sessao`, `/api/inicio` | A sessão traz `conta: {id, email, nick, admin}` no lugar de `usuario` |
| `GET` | `/api/conta` | Dados da conta: nick, e-mail, admin, data de criação, quantos mangás e quantos mangás antigos podem ser trazidos |
| `PUT` | `/api/conta` | Edita `{nick, email, senhaNova, senhaAtual}`; o que não vier fica como está |
| `DELETE` | `/api/conta` | Exclui a conta com `{senha}` |
| `POST` | `/api/conta/mangas-antigos` | Traz os mangás antigos com `{senha}` (a senha antiga do site) |

Novos status de resposta: `403` (senha atual ou senha antiga incorreta) e `409` (e-mail já usado).

No banco, a tabela nova `contas` guarda id, e-mail (único), nick, hash da senha, se é admin e a data de criação.
A coluna `conta` dos mangás e das capas passa a ter o id da conta. A tabela de tentativas ganhou a coluna
`chave` (o e-mail ou o tipo de limite).

Sem banco (versão Java no computador), as contas ficam em `contas.json`, legível só pelo dono do computador, e cada
conta tem uma pasta própria: `contas/{id}/mangas.json` e `contas/{id}/imagens/`. A conta antiga continua em
`mangas.json` e `imagens/`, como antes.

### Variáveis de ambiente

- `MANGATRACKER_USUARIO` **deixou de ser usada**: o login agora é por e-mail.
- `MANGATRACKER_SENHA` **deixou de ser o login** e passou a ser só a senha antiga, usada para trazer os mangás de
  antes das contas. Ela ficou opcional: sem ela, o site funciona, só não oferece a transferência. Depois de trazer
  os mangás, ela pode ser apagada.
- A versão Java deixou de exigir `MANGATRACKER_SENHA` para abrir para a rede, porque agora tudo pede conta.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_contas.js` | Novo: regras de e-mail, nick e senha, e o hash das senhas |
| `api/_sessao.js` | Cookie por conta (v2) |
| `api/index.js` | Tabela de contas, rotas de conta, sessão pela conta, conta da requisição vinda da sessão, limites por chave |
| `domain/Conta.java`, `domain/exceptions/ContaException.java` | Novos: a conta e as recusas de conta |
| `service/ContaService.java`, `service/Senhas.java` | Novos: as regras das contas e o hash das senhas |
| `service/LimiteDeTentativas.java` | Passou a contar por chave (e-mail ou site inteiro); veio de `web/` |
| `repository/ContaRepository.java` e implementações (Postgres, arquivo, memória) | Novos: onde as contas ficam |
| `repository/ContaAtual.java` | Novo: a conta de cada requisição, lida pelos repositórios |
| `repository/JsonMangaRepositoryPorConta.java`, `ArquivoImagemRepositoryPorConta.java` | Novos: uma pasta por conta sem banco |
| `repository/Postgres*Repository.java`, `MangaRepository.java`, `ImagemRepository.java`, `EstruturaDoBanco.java` | Conta da requisição, apagar tudo de uma conta, trazer de outra conta, tabela de contas |
| `web/ApiServer.java`, `web/Sessoes.java` | Rotas de conta e cookie por conta |
| `App.java` | Monta as contas nos dois modos |
| `public/index.html`, `public/app.js`, `public/app.css` | Cadastro, nick no topo, página da conta e confirmação de exclusão |

## Testes

- Java (288 no total): cookie por conta (vencido, alterado, de outra conta, de senha trocada, de outro segredo e o
  mesmo exemplo da versão JavaScript); hash de senha (e um hash feito pela versão JavaScript); limite por chave;
  sem login nada sai; criar conta e entrar; regras do cadastro e e-mail repetido; login errado e o freio por
  e-mail; cada conta só vê os próprios mangás e capas; editar nick, e-mail e senha; excluir a conta; trazer os
  mangás antigos; login que continua depois de reiniciar. O cliente HTTP dos testes entra numa conta antes de
  usar o site.
- JavaScript (57 no total): cookie por conta, regras de e-mail, nick e senha, hash de senha e um hash feito pela
  versão Java.
- Com as duas versões no mesmo banco: conta criada em uma entra na outra, cookie de uma vale na outra, e-mail
  repetido é recusado entre elas, mangá de uma conta não aparece para outra, troca de senha numa desconecta na
  outra e conta excluída numa não entra mais na outra.
- No navegador: criar conta (senhas diferentes, senha curta), trazer os mangás antigos (senha errada e certa),
  editar nick, e-mail e senha (outro aparelho desconectado), segunda conta sem acesso aos mangás da primeira,
  excluir com confirmação (cancelando antes) e o celular.

## O que ficou de fora

- Recuperar a senha esquecida e confirmar o e-mail: precisam de envio de e-mail, que o site não tem.
- Ferramentas de administração (ver contas, apagar abusos).
- Sair de todos os aparelhos sem trocar a senha.
