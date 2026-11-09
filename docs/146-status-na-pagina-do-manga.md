# 146 · Trocar o status na página do mangá

Na página de informações do mangá, o status (Lendo, Concluído, Pausado...) agora muda ali mesmo, como a nota, sem
abrir a edição geral.

- Embaixo da linha do capítulo aparece **"Status:"** com um seletor. Escolher outro status salva na hora e mostra o
  aviso "Status: Concluído", por exemplo.
- O selo colorido do status, ao lado do último capítulo lido, muda junto.
- Se o mangá sai de **Lendo**, o "Capítulo novo: (dia)" some, porque o dia de lançamento só vale para quem está
  lendo. É a mesma regra da edição geral e do "Alterar capítulo".
- Se o servidor recusar, aparece o aviso de erro e o seletor volta ao status salvo.

O servidor não mudou: o seletor usa a mesma rota do "Alterar capítulo" (`PATCH /api/mangas/:id/progresso` só com o
`readingStatus`), que troca o status sem mexer no capítulo.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `src/main/resources/public/app.js` | `telaDetalhes`: seletor de status, selo e dia de capítulo novo atualizados na hora |
| `src/main/resources/public/app.css` | o seletor de status com a largura do conteúdo, como o da nota |
