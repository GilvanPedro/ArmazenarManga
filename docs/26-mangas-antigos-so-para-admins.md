# 26 · Mangás antigos só para admins

Mudança feita em outubro de 2026 na parte **"Mangás de antes das contas"** da página Minha conta (veja
[Contas de usuário](23-contas.md)).

## O que motivou

A parte aparecia para qualquer conta e pedia a senha antiga do site (`MANGATRACKER_SENHA`). O pedido foi deixá-la
só para administradores. Além disso, a conta só virava admin depois de fazer a transferência, então era preciso
outra forma de dizer quem é admin.

## Quem é admin

Uma conta é admin quando:

- o e-mail dela está na variável **`MANGATRACKER_ADMIN_EMAIL`** (pode ter mais de um, separados por vírgula; sem
  diferenciar maiúsculas); ou
- ela já foi marcada como admin no banco (por ter trazido os mangás antigos, ou pela ferramenta
  `ferramentas/passar-mangas-para-conta.mjs`).

Só o dono do site consegue mudar a variável no Vercel, então ela basta como prova de quem é o dono. Não é preciso
mexer no banco para se tornar admin.

## O que mudou

- **Só admins veem** a parte "Mangás de antes das contas". Para as outras contas ela não aparece, e a quantidade de
  mangás antigos vem como 0 (elas nem ficam sabendo que existem).
- **Só admins conseguem** trazer: para as outras contas, `POST /api/conta/mangas-antigos` responde 403 ("Só
  administradores podem trazer os mangás antigos").
- **Sem senha antiga:** no lugar dela, uma janela de confirmação: "N mangás cadastrados passarão para a conta …".
- A conta que traz os mangás continua sendo marcada como admin no banco, e segue admin mesmo que o e-mail saia da
  variável.
- A variável **`MANGATRACKER_SENHA` deixou de ser usada** e pode ser apagada.

## Como trazer os mangás atuais para a sua conta

1. No Vercel, em *Settings > Environment Variables*, criar `MANGATRACKER_ADMIN_EMAIL` com o e-mail da sua conta.
2. Publicar de novo (*Deployments > Redeploy*) para a variável valer.
3. Entrar no site com essa conta e abrir **Minha conta**: a conta aparece com o selo **Admin** e a parte "Mangás de
   antes das contas".
4. Clicar em **"Trazer para esta conta"** e confirmar.

## O que mudou no servidor

| Rota | Antes | Agora |
|------|-------|-------|
| `GET /api/conta` | `mangasAntigos` para quem tinha a senha antiga configurada | `mangasAntigos` só para admins; 0 para as outras contas |
| `POST /api/conta/mangas-antigos` | Corpo `{senha}` com a senha antiga | Sem corpo; só admins (403 para as outras contas) |
| Sessão e conta | `admin` era só a marca do banco | `admin` também é verdadeiro para os e-mails da variável |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | `ehAdmin`, a parte antiga só para admins, fim da senha antiga |
| `service/ContaService.java` | E-mails de admin no lugar da senha antiga, `ehAdmin` |
| `web/ApiServer.java` | `admin` calculado pelo serviço; a rota não lê mais a senha |
| `App.java` | Lê `MANGATRACKER_ADMIN_EMAIL` no lugar de `MANGATRACKER_SENHA` |
| `public/app.js`, `public/app.css` | A parte só para admins, sem campo de senha, com confirmação |
| `render.yaml` | Pergunta `MANGATRACKER_ADMIN_EMAIL` no lugar de `MANGATRACKER_SENHA` |

## Testes

- Java (289 no total): conta comum não vê os mangás antigos e recebe 403 ao tentar trazer; admin pelo e-mail da
  variável (escrito com maiúsculas e espaços) vê, traz e fica marcado; sem a variável, quem trouxe continua admin e
  as outras contas continuam recusadas.
- No navegador, pela versão do Vercel: conta comum sem a parte e sem o selo; admin com o selo, a parte sem campo de
  senha, a confirmação (cancelando antes) e a transferência de 250 mangás.

> A página "Minha conta" agora se chama "Configurações" (o botão do perfil "⚙ Configurações" leva até ela): veja
> [Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md).
