# 79 · A borda Celestial usa o canvas.png

Ajuste feito em outubro de 2026, a pedido do dono do site: a moldura da borda **Celestial** (veja
[Borda Celestial, feita de imagem](62-borda-celestial-de-imagem.md)) passou a vir da imagem guardada com o nome
**`canvas.png`**, e não mais `celestial.webp`.

- O motivo: o dono vai enviar pela aba **Imagens da loja** (veja
  [Imagens da loja: aba do dono e terminal](78-imagens-da-loja-pelo-terminal.md)) o arquivo original, `canvas.png`, e
  a aba preenche o nome com o nome do arquivo. Antes a borda procurava `celestial.webp`, e um PNG não pode ser guardado
  com um nome `.webp` (a conferência das imagens recusa).
- É a mesma imagem (401 × 573 px, com o meio transparente), então o encaixe da moldura na capa não mudou. O PNG é maior
  que o WebP (222 KB contra 41 KB), mas fica guardado no navegador e na CDN.
- No CSS, só o endereço mudou: `url("/api/loja/imagens/canvas.png")`.

**Para a moldura aparecer no site publicado:** em Gerenciar → Imagens da loja, enviar `Downloads/canvas.png` (o nome
`canvas.png` vem sozinho).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | A Celestial lê `/api/loja/imagens/canvas.png` |

## Como foi testado

Num banco local, pela aba Imagens da loja: escolher `canvas.png` preencheu o nome `canvas.png`; depois de enviar, o
site serviu a imagem (`image/png`) e a borda Celestial da loja mostrou a moldura, no mesmo encaixe de antes.
