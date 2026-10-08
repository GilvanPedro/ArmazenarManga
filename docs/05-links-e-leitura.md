# 05 · Links e leitura

Esta é a parte central do sistema: levar ao capítulo certo e manter o link funcionando.

## O modelo do link

Cada mangá guarda o endereço de leitura com `{cap}` no lugar do número do capítulo:

```
https://site.com/manga/solo-leveling/capitulo-{cap}
```

A partir dele e do último capítulo lido, o sistema monta o link do capítulo atual e o do próximo.
O próximo é sempre o inteiro seguinte: de 48 vai para 49, e de 48,5 também.

Sites escrevem capítulos ",5" de formas diferentes, então cada mangá tem um formato: `48-5`, `48.5` ou `48_5`.

## Quando o modelo não basta

Dois comportamentos de sites quebram o modelo:

1. **O id da obra muda.** O endereço `.../obra-3ec3b16f/chapter/174` passa a ser `.../obra-bd5bdaf8/chapter/174`.
   Um modelo novo, com o id novo, volta a servir para todos os capítulos.
2. **Cada capítulo tem um id próprio.** `.../6880186-chapter-7` é seguido de `.../6912345-chapter-8`. Nenhum modelo
   serve; é preciso saber o endereço exato de cada capítulo.

Para o segundo caso, o mangá guarda dois endereços exatos: o do último capítulo lido (`lastChapterUrl`) e o do
próximo (`nextChapterUrl`). Quando existem, eles valem no lugar do modelo.

## Verificação de link

O servidor confere o link no próprio site de leitura, sem código específico de nenhum site:

1. Abre a página do último capítulo lido. Se o site redirecionou para outro endereço que ainda é desse capítulo,
   o id da obra mudou, e o modelo é corrigido.
2. Procura na página o link do próximo capítulo: um `rel="next"`, um link com o número do capítulo, um link que
   diga "next" ou "próximo". Se a página é montada por JavaScript, procura o endereço nos dados embutidos nela.
3. Compara com o que o modelo previa. Se for diferente e o novo modelo também explicar a página atual, o modelo
   é atualizado. Se não, é um site com id por capítulo, e o endereço exato é guardado.
4. Abre o link do próximo capítulo para confirmar que existe. Uma resposta que cai na página inicial ou na página
   da obra conta como "não existe".

O resultado é uma de quatro situações:

| Situação | Significado |
|----------|-------------|
| `DISPONIVEL` | O próximo capítulo abre |
| `NAO_ENCONTRADO` | O capítulo atual abre, mas o próximo não existe (provavelmente não saiu) |
| `LINK_QUEBRADO` | Nem o atual nem o próximo abrem: o link cadastrado parece errado |
| `NAO_VERIFICADO` | O site não respondeu ou bloqueia acessos automáticos; nada é alterado |

### Quando ela roda

- Ao clicar em **Ler**, antes de redirecionar.
- Ao **avançar o capítulo** para o seguinte, para já salvar o link com o id novo.
- Pelo botão **Verificar link**, na página do mangá.

### O que o botão Ler faz com o resultado

- `DISPONIVEL`: abre o próximo capítulo, já com o endereço corrigido.
- `NAO_ENCONTRADO`: volta para a página do mangá com um aviso e um botão para abrir o último capítulo lido.
- `LINK_QUEBRADO`: volta para a página do mangá sugerindo a edição geral.
- `NAO_VERIFICADO`: abre o melhor endereço conhecido. Se só o endereço exato do último capítulo é conhecido,
  abre esse, que tem o botão de próximo do próprio site.

### Limite: sites que bloqueiam o servidor

Sites com proteção contra robôs entregam as páginas só a um navegador de verdade. O servidor recebe um bloqueio,
e a verificação responde `NAO_VERIFICADO`. O projeto **não** tenta contornar essa proteção. Para esses sites, o
endereço é capturado no navegador de quem lê, pela extensão ou pelo favorito.

## Marcar o capítulo como lido

Há três caminhos, todos chegando à mesma rota (`capitulo-lido`):

- **Extensão de navegador:** botão "✓ Lido" nas páginas de leitura, ícone da extensão ou Alt+Shift+L.
- **Favorito:** um botão da barra de favoritos, para quem não usa a extensão.
- **Colar o link:** no diálogo de alterar capítulo há o campo "Link do capítulo lido".

Os dois primeiros abrem o site na tela **Marcar capítulo lido**, que mostra o que foi capturado para confirmar.
Nada é salvo antes do clique em Salvar. Ao salvar:

- o último capítulo e o endereço exato dele são gravados;
- o endereço do próximo capítulo também, se a página tinha o link;
- o modelo passa a ter o id que estiver no endereço.

### Reconhecer o mangá

A tela precisa descobrir a qual mangá da lista a página pertence. Ela tenta, nesta ordem:

1. **Pelo nome.** O título da página é limpo (saem "[Manga]", "Read", "Chapter 12", "Online", o nome do site) e
   comparado com os títulos e os outros nomes de cada mangá.
2. **Pelo endereço.** Mesmo site e mesma obra no caminho, aceitando que só o id do fim tenha mudado.
3. **Por conter o nome.** O nome de um mangá aparece inteiro no título da página. Vale o nome mais comprido, para
   "Solo Leveling: Ragnarok" não ser confundido com "Solo Leveling".

Na dúvida entre dois mangás, nenhum é sugerido. O campo de busca permite corrigir, e a última opção é sempre
cadastrar como mangá novo.

### Mangá que não está na lista

Se nada bate, abre o cadastro já preenchido com o nome, o capítulo, o modelo do link, a capa informada pela
página e a descrição buscada na internet.

O número do capítulo vem do título da página quando ele diz ("Ch.90"), porque em alguns sites o número do
endereço é um código interno.

## Lançam hoje

A aba mostra os mangás com status Lendo cujo dia de lançamento é hoje. Quando o capítulo de um deles avança,
ele sai da lista naquele dia e volta na semana seguinte. "Hoje" é contado no relógio do aparelho de quem usa,
não no do servidor.
