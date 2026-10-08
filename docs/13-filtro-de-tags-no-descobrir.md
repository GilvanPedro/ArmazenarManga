# 13 · Filtro de tags na aba Descobrir

Mudança feita em outubro de 2026 na forma de escolher tags na aba **Descobrir**, e a chegada das tags que a
busca deve deixar de fora.

## O que motivou

A aba mostrava as tags em uma única linha que rolava para o lado. Com muitas tags, achar uma delas exigia rolar
até ela. Também não havia como dizer "não quero obras com esta tag".

## O que mudou na tela

No lugar da linha de botões, a aba tem dois quadros lado a lado (um embaixo do outro em telas estreitas):

| Quadro | Efeito na busca |
|--------|-----------------|
| **Quero com estas tags** | A obra precisa ter **todas** as tags marcadas |
| **Não quero com estas tags** | A obra não pode ter **nenhuma** das tags marcadas |

Os dois funcionam do mesmo jeito:

- **Pesquisar pelo nome.** O campo "Pesquisar tag…" filtra a lista enquanto se digita, sem diferenciar
  maiúsculas nem acentos. Enter marca a primeira tag encontrada e limpa o campo para a próxima.
- **Procurar rolando.** Sem nada digitado, todas as tags aparecem, quebrando em várias linhas. A lista rola
  para baixo, não mais para o lado.
- **Tags marcadas em cima.** Cada uma tem um × para tirar, e "Limpar" tira todas do quadro.
- **Uma tag só pode estar em um quadro.** A tag marcada em um aparece riscada e travada no outro, e é liberada
  quando sai do primeiro.

Os quadros mostram **todas as tags do site**, com as que estão em uso em algum mangá primeiro. Antes apareciam
só as em uso. A mudança existe por causa da exclusão: o que não se quer ler normalmente não está na lista.

O aviso acima dos resultados passou a dizer quando há tags excluídas valendo.

Depois desta mudança a lista passou a poder ser recolhida; veja
[Recolher as tags no Descobrir](14-recolher-tags-no-descobrir.md).

## O que mudou no servidor

A rota `GET /api/recomendacoes` ganhou o parâmetro `sem`, com as tags excluídas separadas por vírgula (até 20):

```
/api/recomendacoes?tags=Fantasy&sem=Horror,Romance&ordem=POPULARIDADE&pagina=1
```

As tags excluídas passam pela mesma conversão das pedidas (veja [Recomendações](06-recomendacoes.md)):

- uma tag que é **gênero** no AniList vai no filtro `genre_not_in`; as outras vão em `tag_not_in`;
- **Murim** é excluída como Wuxia;
- **Harem** exclui Female Harem e Male Harem de uma vez. Na inclusão ela exige duas buscas (uma por forma);
  na exclusão basta uma, porque o filtro já tira qualquer uma das formas;
- uma tag que o AniList não tem é ignorada e devolvida em `tagsIgnoradas`;
- uma tag que venha nas duas listas vale como **pedida**. A tela já impede isso; a regra protege quem chama a
  rota direto.

A mudança foi feita nas duas versões do servidor.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `service/RecomendacaoService.java` | `explorar` recebe as tags excluídas e monta os filtros de exclusão |
| `web/ApiServer.java` | Lê o parâmetro `sem` |
| `api/_recomendacoes.js`, `api/index.js` | O mesmo, na versão JavaScript |
| `public/app.js` | Função `quadroDeTags` e o novo estado `descobrir.sem` |
| `public/app.css` | Estilos dos quadros |

## Testes

- Um teste novo em cada versão confere a pergunta enviada ao AniList: gêneros e temas excluídos, Murim, Harem,
  tag desconhecida, tag nas duas listas e a ausência dos filtros quando nada é excluído.
- O teste da rota em Java confere a leitura do parâmetro `sem`.
- A tela foi conferida em um navegador, contra o AniList de verdade: pesquisa, Enter, trava entre os quadros,
  ×, "Limpar" e largura de celular.

Total depois da mudança: 253 testes em Java e 47 em JavaScript. Os quadros em si não têm teste automático, como
o resto do front-end.

## O que ficou de fora

- As escolhas valem enquanto a página está aberta. Recarregar o site zera os dois quadros.
- Não há como excluir uma tag que não esteja cadastrada no site. Basta criá-la em um mangá para ela aparecer.
