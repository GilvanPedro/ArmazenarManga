# 102 · Descrição sempre em português

A descrição buscada na internet no cadastro de um mangá às vezes ficava em inglês. A busca (`api/_sinopse.js`) pega
a descrição em português do MangaDex quando existe; quando só há em inglês (AniList ou MangaDex), traduz. Mas a
tradução era só pelo **MyMemory**, um serviço gratuito que falha com frequência (cota diária, limite de pedidos por
texto) e que às vezes devolve o próprio texto ou lixo da memória dele (num teste, "Hello world" voltou como "Hello
world translated mierda"). Quando falhava, a descrição ficava em inglês.

## O que mudou

1. **Três tradutores, em ordem:** o Google pelo endereço gratuito da extensão do Chrome (`clients5.google.com`, o
   texto inteiro de uma vez, mantendo os parágrafos), o Google pelo outro endereço gratuito
   (`translate.googleapis.com`) e, só se os dois falharem, o MyMemory, como antes.
2. **A tradução só vale se voltou em português:** diferente do original e sem cara de inglês (`pareceIngles`, que
   conta as palavras mais comuns de cada língua). O MyMemory devolvendo o mesmo texto não conta mais como traduzido.
3. **A descrição "em português" do MangaDex também é conferida:** às vezes ela está em inglês; nesse caso passa pela
   tradução.
4. **Ao salvar (cadastro ou edição geral), a descrição em inglês é traduzida pelo servidor** antes de ir para o banco,
   venha de onde vier: buscada, colada ou escrita. Texto em português passa direto, sem chamar tradutor nenhum. Se
   todos os tradutores falharem nesse momento, a descrição é salva como veio.

No formulário, se a busca não conseguiu traduzir na hora, o aviso diz que a descrição veio em inglês e que o site
traduz ao salvar.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_sinopse.js` | Os tradutores do Google antes do MyMemory, a conferência `pareceIngles`, o MangaDex "em português" em inglês e `criarTradutorDeDescricao` |
| `api/index.js` | A descrição traduzida ao salvar o mangá |
| `public/app.js` | O aviso quando a descrição veio em inglês |
| `test-api/sinopse.test.mjs` | A ordem dos tradutores, a tradução que volta em inglês, o MangaDex em inglês, a tradução ao salvar e `pareceIngles` (com um tradutor de mentira que devolve português) |

A versão Java antiga (`SinopseService.java`) não foi mudada: o site no ar usa só a versão JavaScript.

## Como foi testado

- Os 106 testes passam.
- No servidor local, com a internet de verdade: as descrições de Doomsday Wedding, The Eminence in Shadow, Omniscient
  Reader e Raising Villains the Right Way (só em inglês no AniList) voltaram traduzidas pelo Google. Um mangá salvo com
  a descrição colada em inglês foi gravado em português; um com a descrição em português ficou igual.

> Depois, a busca passou a usar cinco sites e a juntar as tags: veja [Descrição e tags de vários sites](103-descricao-e-tags-de-varios-sites.md).
