# 09 · Hospedagem e configuração

## Rodar no computador

Precisa do JDK 25 ou mais novo e do Maven.

```bash
./iniciar.sh
```

O script escolhe o JDK, gera o `.jar` se faltar, carrega o arquivo `.env` se existir e inicia. O site abre em
`http://localhost:7070`. À mão, o equivalente é:

```bash
mvn package
java -jar target/mangatracker.jar
```

Sem configuração nenhuma, os dados ficam em `~/.mangatracker/` e não há login, porque o programa só atende o
próprio computador.

### Abrir para a rede local

```bash
MANGATRACKER_HOST=0.0.0.0 MANGATRACKER_SENHA='uma senha longa' java -jar target/mangatracker.jar
```

O terminal mostra o endereço para os outros aparelhos. Sem uma senha de pelo menos 12 caracteres, o programa
se recusa a abrir para a rede.

## Variáveis de configuração

| Variável | Padrão | Para que serve |
|----------|--------|----------------|
| `PORT` | `7070` | Porta do site |
| `MANGATRACKER_DIR` | `~/.mangatracker` | Pasta do `mangas.json` e das capas |
| `DATABASE_URL` | vazio | Endereço de um Postgres. Com ele, os dados vão para o banco |
| `MANGATRACKER_HOST` | `127.0.0.1` | `0.0.0.0` aceita conexões de outros computadores |
| `MANGATRACKER_USUARIO` | `manga` | Usuário do login |
| `MANGATRACKER_SENHA` | vazio | Senha do login |
| `MANGATRACKER_CORS` | vazio | Outros sites que podem chamar a API (só na versão Java) |

O arquivo `.env`, na raiz, guarda essas variáveis para uso local. Ele contém a senha do banco e não vai para o
GitHub; o `.env.exemplo` é o modelo.

## Banco de dados: Neon

O banco usado é um Postgres gratuito do Neon. As tabelas são criadas sozinhas no primeiro acesso.

1. Criar um projeto no Neon e copiar a *connection string* (`postgresql://usuario:senha@servidor/banco?sslmode=require`).
2. Colocá-la em `DATABASE_URL`, no `.env` local ou nas variáveis da hospedagem.

O Vercel, o Render e o computador local podem apontar para o mesmo banco e ver os mesmos mangás.

## Vercel

É onde o site está publicado. O Vercel não roda Java, então lá a API é a versão JavaScript (`api/`).

1. Importar o repositório no Vercel. O `vercel.json` já traz a configuração.
2. Em *Settings > Environment Variables*, definir `DATABASE_URL` e `MANGATRACKER_SENHA` (mínimo de 12 caracteres).
3. Publicar de novo para as variáveis valerem.

A cada `git push` na `main`, o Vercel publica sozinho. Se faltar alguma variável, a própria página mostra qual.

## Render

Alternativa que roda a versão Java, usando o `Dockerfile` e o `render.yaml`.

1. Em *New > Blueprint*, selecionar o repositório.
2. Informar `DATABASE_URL` e `MANGATRACKER_SENHA`.

No plano gratuito, o site dorme após 15 minutos sem uso e leva cerca de um minuto para acordar.

## Arquivos de hospedagem no repositório

| Arquivo | Usado por |
|---------|-----------|
| `vercel.json`, `package.json`, `api/` | Vercel |
| `Dockerfile`, `.dockerignore`, `render.yaml` | Render (ou qualquer hospedagem com Docker) |
| `fly.toml` | Nenhuma. Sobrou de uma tentativa com o Fly.io e pode ser apagado |

## Acesso pela internet sem hospedagem

Quem roda no próprio computador e quer acessar de fora precisa colocar o site atrás de HTTPS, com um túnel ou um
proxy reverso. Abrir a porta direto expõe a senha sem criptografia.
