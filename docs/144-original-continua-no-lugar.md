# 144 · O post original continua no lugar depois do repost

Ao repostar um post (o repost simples, sem citar), o post original **sumia do lugar dele** no feed e no perfil e
aparecia só em cima, como repost. Isso acontecia porque o feed contava o post e os reposts dele como uma coisa só e
ficava com o que aparecia primeiro: o repost, que é sempre mais novo.

Agora:

- **o post original sempre fica no lugar dele**, pela data em que foi publicado;
- **o repost aparece em cima**, com "Você repostou" (ou "Fulano repostou");
- **vários reposts do mesmo post** (de pessoas diferentes) continuam aparecendo **uma vez só**: o mais novo.

Exemplo (o Kai publica A e depois B, e reposta A; a Mei também reposta A):

| Antes | Agora |
|-------|-------|
| 1. A, repostado | 1. A, repostado (o repost mais novo) |
| 2. B | 2. B |
| | 3. A, no lugar original |

Vale para o feed "Para você", o "Seguindo" e o perfil. Testado com duas contas nos três.

Desfazer o repost tira só o repost: o original continua onde está.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_comunidade_rotas.js` | `semRepetir`: os originais sempre ficam; só os reposts repetidos de um mesmo post saem |
