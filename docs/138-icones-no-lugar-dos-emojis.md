# 138 · Ícones no lugar dos emojis nos posts

Os botões dos posts e do editor de post da Comunidade usavam emojis (💬, 🔁, ♡/♥, 👥, 🗑, ✎, 🖼, 📚). Emojis mudam de desenho em cada aparelho e
sistema, têm cores próprias que não seguem o tema e ficam de tamanhos diferentes. Agora são **ícones de linha**
desenhados para o site (SVG), na cor do texto do botão.

| Onde | Antes | Agora |
|------|-------|-------|
| Comentários | 💬 | um balão de conversa |
| Repost (botão, menu e "Fulano repostou") | 🔁 | duas setas em círculo |
| Curtidas | ♡ / ♥ | um coração: só o contorno, e cheio (vermelho) quando curtido |
| Quem curtiu | 👥 | duas pessoas |
| Apagar | 🗑 | uma lixeira |
| Citar (no menu) e o botão flutuante de escrever | ✎ | um lápis |
| Imagem, no editor de post | 🖼 | um quadro com montanha e sol |
| Lista, no editor de post e no resumo da lista de um post citado | 📚 | livros (o mesmo desenho do ícone da Biblioteca no topo) |

- Os ícones usam a cor do texto: mudam com o tema e com o modo escuro, como o resto do botão. O repost repostado fica
  verde e a curtida, vermelha, como antes.
- Ao apertar curtir ou repostar, o ícone encolhe um pouco, para mostrar o toque.
- São decorativos para leitores de tela: quem usa um ouve o nome do botão ("curtidas", "reposts", "Apagar post").
- No celular estreito (até 420 px), Imagem e Lista mostram só o ícone, como antes mostravam só o emoji.

Por dentro: `ICONES` (os desenhos, num quadro de 24 × 24) e `icone(nome)`, que cria o SVG. O CSS `.icone` define o
traço; cada lugar ajusta o tamanho.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `ICONES` e `icone()`; os botões dos posts, o menu de repost, o "repostou", o botão de escrever e o Imagem e Lista do editor com os ícones |
| `public/app.css` | O estilo `.icone`, o coração cheio quando curtido e os tamanhos de cada lugar |
