# 78 · Imagens da loja: a aba só do dono e o terminal

Feito em outubro de 2026, a pedido do dono do site. As imagens dos itens da loja que não são feitos só com código
(como a moldura da borda **Celestial**) continuam **no banco de dados**, e o site serve elas em
`/api/loja/imagens/{nome}`. Para guardá-las, há duas formas, ambas só para o dono:

1. **A aba Imagens da loja** do Gerenciar, de volta (ela tinha saído na
   [doc 77](77-sem-a-aba-imagens-da-loja.md)), **só na conta do dono do site**: os outros admins não veem a aba, e as
   rotas de listar, enviar e apagar respondem 403 para eles. É a mesma tela de antes (veja
   [Imagens da loja no banco](63-imagens-da-loja-no-banco.md)): enviar (o nome vem do arquivo), trocar enviando com o
   mesmo nome, e apagar.
2. **A ferramenta do terminal**, `ferramentas/imagens-da-loja.mjs`, que se conecta direto ao banco, sem passar pelo
   site.

As duas usam a mesma conferência (`conferirImagemDaLoja`, em `api/_loja.js`): o formato pelos primeiros bytes do
arquivo (WebP, PNG ou GIF; SVG não entra), até 3 MB, e o nome só com letras minúsculas, números e hífen, terminando com
a extensão do formato de verdade. Trocar uma imagem aparece para todo mundo em até uma hora (a CDN guarda por uma hora).

## A ferramenta do terminal

```bash
node ferramentas/imagens-da-loja.mjs listar
node ferramentas/imagens-da-loja.mjs enviar caminho/da/imagem.webp [nome.webp]
node ferramentas/imagens-da-loja.mjs apagar nome.webp
```

Ela usa a variável `DATABASE_URL` (o endereço do Neon, o mesmo do Vercel), do ambiente ou de um arquivo **`.env`** na
raiz do projeto com a linha `DATABASE_URL=postgres://...`. O `.gitignore` já deixa o `.env` fora do GitHub; o endereço
do banco é uma senha.

## A borda Celestial no site publicado

A imagem dela nunca tinha sido enviada para o banco do site publicado. Para a moldura aparecer: na aba **Imagens da
loja**, enviar `Downloads/viracap-loja/celestial.webp` (o nome `celestial.webp` vem sozinho), ou pelo terminal:
`node ferramentas/imagens-da-loja.mjs enviar ~/Downloads/viracap-loja/celestial.webp`.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | As rotas de listar, enviar e apagar de volta (só o dono) e a conferência das imagens |
| `public/app.js` e `public/app.css` | A aba Imagens da loja de volta, só na conta do dono |
| `ferramentas/imagens-da-loja.mjs` | Novo: listar, enviar e apagar pelo terminal |
| `test-api/loja.test.mjs` | O teste da conferência das imagens de volta |

## Como foi testado

Num banco local: a dona do site viu as abas Painel, Finanças, Banners, **Imagens da loja**, Contas e Registro e enviou
a imagem da Celestial pela aba; um admin que não é o dono viu só Contas e Registro e recebeu 403 ao listar e ao enviar;
a ferramenta listou a imagem enviada pela aba; e o site serviu a imagem. A ferramenta também foi testada sozinha:
enviar, trocar, recusar um WebP com nome `.png`, apagar, e a mensagem quando falta o endereço do banco. Os 95 testes
da versão JavaScript passam, e o site compactado foi conferido.

> Depois, a Celestial passou a usar a imagem `canvas.png` (enviar `Downloads/canvas.png`): veja
> [A borda Celestial usa o canvas.png](79-celestial-com-canvas-png.md).
