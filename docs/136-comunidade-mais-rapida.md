# 136 · Comunidade mais rápida

Entrar na Comunidade (e trocar de parte do site) demorava para mostrar as coisas. O servidor responde o feed em
~0,3 s, mas cada entrada começava do zero: a tela ficava vazia até a resposta chegar, mesmo voltando de outra parte
um instante depois.

## O que mudou

### O feed e o "Quem seguir" guardados

O feed e o "Quem seguir" vistos há pouco (até 5 minutos) aparecem **na hora** ao voltar para a Comunidade. O novo é
pedido por trás e, quando chega:

- se mudou alguma coisa e a pessoa ainda está no começo da página, o feed é trocado pelo novo;
- se ela já rolou ou está escrevendo num post, o guardado fica, para não mexer no que ela está lendo.

O guardado é esquecido quando a pessoa posta, curte, comenta, segue ou muda a conta, e quando clica de novo na aba
aberta (que sempre busca tudo de novo).

### O pedido sai antes do clique

Quando o mouse passa no link **Comunidade** do topo (ou o dedo encosta nele, no celular), o feed e o "Quem seguir" já
começam a ser buscados. Até o clique terminar, boa parte da espera já passou.

### Posts fora da tela não são desenhados

Os posts do feed usam `content-visibility: auto`: o navegador **não desenha os posts fora da tela** e volta a
desenhá-los quando eles reaparecem, rolando para cima ou para baixo. A altura de cada post fica guardada, então a
rolagem não pula. Com 30 posts carregados, só os 4 a 6 que estão na tela são desenhados.

Os posts continuam chegando aos poucos: 10 ao abrir e mais 10 ao chegar perto do fim. As imagens dos posts e agora
também as fotos de perfil só são baixadas quando chegam perto da tela.

### O servidor perto do banco

As funções da Vercel rodavam na Virgínia (`iad1`) e o banco (Neon) fica em Ohio (`us-east-2`): cada consulta ao banco
atravessava essa distância, e um pedido faz várias. Agora as funções rodam em Cleveland (`cle1`, a mesma região do
banco), pelo `"regions"` do `vercel.json`. Para quem está no Brasil, a distância até o site quase não muda.

## Medidas (teste com o servidor atrasado em 0,6 s de propósito, como se estivesse longe)

| O quê | Antes | Depois |
|-------|-------|--------|
| Primeira entrada na Comunidade (passando o mouse no link antes) | ~0,7 s | ~0,4 s |
| Voltar para a Comunidade | ~0,7 s | ~0,09 s |
| Posts desenhados com 30 no feed | 30 | os 4 a 6 da tela |

Testado no Chrome e no Firefox: o post 5 fica exatamente no mesmo lugar depois de rolar até o fim e voltar ao topo.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Feed e "Quem seguir" guardados (`respostaGuardada`, `pedirGuardando`), `adiantarComunidade`, `montarFeed`, fotos de perfil com `loading="lazy"` |
| `public/app.css` | `content-visibility: auto` nos posts do feed |
| `vercel.json` | `"regions": ["cle1"]`, a região do banco |
