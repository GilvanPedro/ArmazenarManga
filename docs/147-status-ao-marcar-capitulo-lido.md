# 147 · Trocar o status ao marcar um capítulo lido

A tela **"Marcar capítulo lido"** é a que abre pela extensão, pelo atalho dos favoritos ou ao buscar o mangá. Ela
ganhou o campo **"Status da leitura"**, para trocar o status junto com o capítulo, por exemplo ao ler o último
capítulo e já marcar como Concluído.

- O campo já vem com o status do mangá reconhecido pelo link ou pelo nome.
- Se você escolher outro mangá na busca, o campo passa a mostrar o status desse mangá.
- Ao salvar, o capítulo e o status são gravados de uma vez.
- Se o mangá deixar de estar como **Lendo**, o dia de capítulo novo deixa de valer. É a mesma regra da edição geral,
  do "Alterar capítulo" e da página do mangá ([doc 146](146-status-na-pagina-do-manga.md)).

## Servidor

`POST /api/mangas/:id/capitulo-lido` aceita um `readingStatus` opcional. Sem ele, o status continua o mesmo, e quem
já usava a rota (como a extensão) não muda nada. Um status que não existe é recusado (400).

## Correção junto

A lista de sugestões da busca de mangá mostrava a palavra **"null"** quando havia resultado. Corrigido.

## Testes

Feitos num Postgres local e no Chromium:
- marcar sem status mantém o status;
- marcar com "Concluído" salva o status e tira o dia de capítulo novo;
- um status inválido é recusado;
- o campo acompanha o mangá escolhido na busca;
- a página do mangá troca o status pelo seletor.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | `capitulo-lido` com `readingStatus` opcional e a regra do dia de lançamento |
| `src/main/resources/public/app.js` | `telaCapturar`: campo "Status da leitura"; `buscaDeManga`: avisa quando o mangá escolhido muda (`aoEscolher`) e não escreve mais "null" na lista |
