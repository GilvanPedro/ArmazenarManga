# 24 · Foto de perfil

Mudança feita em outubro de 2026: cada conta pode ter uma foto de perfil. Ela complementa
[Contas de usuário](23-contas.md).

## Como funciona

- Em **Minha conta**, a parte **"Foto de perfil"** tem os botões **Escolher foto** (ou **Trocar foto**, quando
  já existe uma) e **Remover foto**.
- A foto aparece no **topo do site**, no círculo ao lado do nick, e no cabeçalho da página da conta. Sem foto,
  continua aparecendo a inicial do nick.
- O navegador **corta a imagem em quadrado, pelo meio**, e a diminui para 256x256 em WebP (ou JPEG) antes de
  enviar. Uma foto de 900x1350 com 210 KB foi guardada com 8 KB.
- Trocar ou remover a foto apaga a imagem antiga.
- Um arquivo que não é imagem mostra "Não foi possível ler essa imagem. Escolha outra.".

## Privacidade

A foto é uma imagem da própria conta, guardada como as capas: só quem está na conta consegue abri-la. Outra conta
não a vê e não consegue usá-la como foto. Excluir a conta apaga a foto junto.

## O que mudou no servidor

- A tabela `contas` ganhou a coluna `foto`, com o nome da imagem (ou vazia). Sem banco, o campo `foto` vai no
  `contas.json`.
- A conta, nas respostas da sessão, de `/api/inicio` e de `GET /api/conta`, traz `foto`: o endereço da imagem
  (`/api/imagens/…`) ou `null`.
- A foto é enviada como as capas (`POST /api/imagens`) e depois ligada à conta com `PUT /api/conta`:

```
{"foto": "nome-da-imagem.webp"}    usa a imagem como foto
{"foto": null}                     tira a foto
```

  Sem o campo `foto`, a foto fica como está. Uma imagem que não existe na conta, ou um valor que não é texto,
  devolve 400.
- A imagem que é a foto da conta não é apagada quando um mangá deixa de usá-la (versão do Vercel).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | Coluna `foto`, `foto` na conta e na edição, foto antiga apagada ao trocar |
| `domain/Conta.java` | Campo `foto` |
| `repository/PostgresContaRepository.java`, `ArquivoContaRepository.java`, `EstruturaDoBanco.java` | Guardar a foto |
| `service/ContaService.java` | `trocarFoto` |
| `web/ApiServer.java` | `foto` nas respostas e na edição da conta |
| `public/app.js`, `public/app.css` | Foto no topo e na página da conta, recorte em quadrado |

## Testes

- Java (289 no total): a foto aparece na sessão e na conta; outra conta não abre a foto nem a usa; nome inválido e
  valor que não é texto são recusados; editar só o nick mantém a foto; trocar e remover apagam a imagem antiga.
- No navegador, pela versão do Vercel: escolher (recorte e tamanho), trocar (a antiga some), recarregar, remover e
  um arquivo que não é imagem.

## Ferramenta: passar os mangás antigos para uma conta

Junto com esta mudança veio `ferramentas/passar-mangas-para-conta.mjs`. Ela faz o mesmo que o botão "Trazer para
esta conta" (veja [Contas de usuário](23-contas.md)), mas pelo e-mail da conta e sem a senha antiga do site. Usa o
banco de `DATABASE_URL` (do arquivo `.env` na raiz do projeto):

```bash
node ferramentas/passar-mangas-para-conta.mjs email@exemplo.com              # só mostra o que seria feito
node ferramentas/passar-mangas-para-conta.mjs email@exemplo.com --confirmar  # faz a transferência
```

A conta precisa existir antes. A transferência acontece de uma vez (tudo ou nada) e marca a conta como admin.
Rodar de novo não muda nada.
