# 21 · Desempenho da lista, da busca e das capas

Mudança feita em outubro de 2026 para a lista de mangás, a busca e as capas aparecerem em até 2 segundos, e para
a aba já aberta recarregar quando se clica nela de novo.

## O que motivou

A meta pedida foi: todos os mangás e capas da tela aparecendo corretamente em até 2 segundos. Cada ação da lista
dependia do servidor, e cada chamada ao servidor no Vercel passa pela função e pelo banco na nuvem:

- abrir o site fazia **7 chamadas** antes de mostrar qualquer mangá (sessão, status, formatos, dias, duas listas de
  ordens e a página da lista), em três etapas seguidas;
- cada busca, filtro de status e troca de página pedia a lista de novo ao servidor;
- as capas enviadas eram mostradas na lista do tamanho em que foram enviadas. Uma capa de 900x1350 pesa uns
  210 KB, e a lista mostra no cartão algo de uns 200 px de largura.

## O que mudou

### Abrir o site: uma chamada no lugar de seis

A rota nova `GET /api/inicio` devolve, de uma vez, a sessão e as listas fixas (status, formatos, dias e ordens).
Na página principal, a lista de mangás é pedida **ao mesmo tempo** que o início, sem esperar por ele. Abrir a
lista passou de três etapas seguidas para uma.

### Lista guardada no navegador: busca, filtros e páginas na hora

A grade agora pede a **lista inteira** uma vez, já na ordem escolhida e sem as descrições
(`GET /api/mangas?resumo=1`), e guarda no navegador. A partir daí, sem nenhuma chamada ao servidor:

- a **busca pelo nome** filtra enquanto se digita (mesma regra do servidor: sem diferenciar maiúsculas nem
  acentos);
- os **filtros de status** e de **tag** trocam na hora;
- **trocar de página** é imediato.

Trocar a ordem pede a lista de novo, já ordenada pelo servidor.

A lista guardada é mantida atualizada assim:

- qualquer alteração (cadastrar, editar, marcar capítulo, nota, favorito, excluir…) descarta a lista guardada, e a
  próxima vez que a grade aparece ela vem nova do servidor;
- voltar para a lista depois de 20 segundos mostra a lista guardada na hora e confere o servidor por trás,
  redesenhando só se algo mudou (por exemplo, um capítulo marcado pela extensão em outra aba);
- clicar na aba já aberta busca tudo de novo (veja abaixo).

Com a lista inteira no navegador, os resultados da busca e dos filtros foram conferidos contra os do servidor e
são iguais.

### Miniaturas das capas

Cada capa enviada ganha uma **miniatura** de 400x600 em WebP, usada nos cartões. A capa original não muda e
continua sendo usada na página do mangá.

- As miniaturas são feitas **pelo próprio navegador**, por trás e devagar, depois que a lista aparece: ele lê a
  capa, reduz e manda guardar (`PUT /api/imagens/{nome}/miniatura`). Não foi preciso nenhuma biblioteca de
  imagem no servidor.
- No primeiro uso depois desta mudança, as capas antigas vão ganhando miniatura aos poucos; da segunda vez em
  diante, a lista já abre com elas. Nos testes, 120 capas levaram cerca de um minuto, sem atrapalhar o uso.
- Uma capa de 206 KB virou uma miniatura de 13 KB.
- Capas que já são pequenas (a miniatura não ficaria pelo menos 30% menor) e GIFs ficam como estão, e não são
  tentadas de novo.
- Capas que são links de outros sites (AniList, sites de leitura) não ganham miniatura: elas vêm direto do site
  de origem, e o navegador não pode lê-las para reduzir.
- Apagar uma capa apaga a miniatura junto.

### Capas novas já vão reduzidas

Ao cadastrar ou editar com uma capa do computador, o navegador reduz a imagem para no máximo 600x900 antes de
enviar, em WebP (ou JPEG nos navegadores que não gravam WebP). Uma capa de 900x1350 com 206 KB foi guardada com
32 KB. GIFs, imagens já pequenas e imagens que o navegador não consegue ler vão como estão.

### Página do mangá

A capa aparece na hora usando a miniatura, que já veio com a lista, e troca para a capa inteira assim que ela
chega.

### Capas na tela

- As duas primeiras fileiras de capas são pedidas na hora, e as seis primeiras com prioridade alta; o resto
  espera a rolagem chegar perto.
- As capas da **próxima página** são baixadas quando o navegador fica parado, para a troca de página ser imediata.
- O espaço de cada capa é reservado antes de ela chegar, para a página não pular.

### Clicar na aba aberta recarrega

Clicar no título da aba que já está aberta busca o conteúdo dela de novo:

| Aba | O que recarrega |
|-----|-----------------|
| Todos os mangás | A lista inteira, mantendo a busca, os filtros e a página |
| Lançam hoje | Os lançamentos do dia |
| Descobrir | As tags e a busca de obras |
| Extensão e atalho | A tela |

Enquanto o novo chega, o que está na tela fica apagado.

## Resultado medido

Medido em um ambiente que imita o Vercel: a mesma função JavaScript, um banco Postgres local com **120 mangás e
capas enviadas de 900x1350 (cerca de 210 KB cada)**, mais 150 ms de atraso em cada chamada da função (a função e
o banco na nuvem) e uma rede de 25 Mbps com 60 ms de ida e volta. A tela tinha 1366x768.

| Ação | Antes | Depois |
|------|------:|-------:|
| Abrir o site, sem nada guardado no navegador | 1,8 s | **0,9 s** |
| Buscar "tower" | 1,7 s | **0,5 s** |
| Apagar a busca | 0,4 s | **0,1 s** |
| Filtrar por "Concluído" | 1,2 s | **0,4 s** |
| Voltar para "Todos" | 0,3 s | **0,06 s** |
| Ir para a página 2 | 1,1 s | **0,1 s** |
| Rolar até o fim da página 2 | 0,6 s | **0,02 s** |
| Voltar para a lista depois de abrir um mangá | 0,2 s | **0,03 s** |
| Ir a "Lançam hoje" e voltar | 0,3 s | **0,1 s** |
| Abrir um mangá (até a capa inteira chegar) | 0,2 s | 0,7 s |

O tempo é contado até todos os mangás e todas as capas visíveis estarem desenhados. A página 2 e a rolagem ficaram
quase instantâneas porque as capas já tinham sido baixadas por trás. Os dados transferidos para abrir o site
caíram de 578 KB para 215 KB.

A única ação que ficou mais lenta foi abrir um mangá, até a capa inteira chegar. Antes ela já estava no navegador,
porque os cartões usavam a capa inteira; agora os cartões usam a miniatura. A capa aparece na hora com a miniatura
e fica nítida em cerca de 0,7 s.

Os números "depois" são da segunda visita em diante, quando as miniaturas já existem. Na primeira visita após a
mudança, as capas ainda são as originais enquanto as miniaturas vão sendo feitas.

## O que o código não controla

No Vercel de verdade, alguns tempos dependem da hospedagem:

- **Banco dormindo.** O plano gratuito do Neon desliga o banco depois de alguns minutos sem uso. A primeira chamada
  depois disso espera ele acordar, o que pode passar de 1 segundo. As seguintes voltam ao normal.
- **Função fria.** A primeira chamada a uma função parada há algum tempo também demora um pouco mais.
- **Região.** Se a função do Vercel e o banco do Neon estiverem em regiões diferentes, cada consulta ao banco paga
  a distância. A região do banco aparece no endereço de conexão do Neon (por exemplo, `sa-east-1` ou
  `us-east-2`); a da função, nas configurações do projeto no Vercel (*Settings > Functions > Function Region*).
  Deixar as duas iguais é a melhoria isolada mais efetiva fora do código.
- **Capas de outros sites.** Capas que são links de outros sites vêm de lá, na velocidade de lá.

## O que mudou no servidor

| Rota | O que faz |
|------|-----------|
| `GET /api/inicio` | Sessão e listas fixas em uma chamada. Não pede login (as listas não têm dados da lista de mangás) |
| `GET /api/mangas?resumo=1` | A lista sem `description` e `altTitles`, que os cartões não usam |
| `PUT /api/imagens/{nome}/miniatura` | Guarda a miniatura de uma capa enviada. Corpo: a imagem, WebP ou JPEG, até 300 KB |

- As respostas das listas (`/api/mangas`, lançamentos e semelhantes) trazem `thumbUrl`: o endereço da miniatura,
  ou `null` se a capa ainda não tem uma.
- A miniatura de `abc.png` se chama `abc-mini.webp` (ou `abc-mini.jpg`) e é servida por
  `GET /api/imagens/{nome}`, como as capas.
- As rotas antigas de status, formatos, dias e ordens continuam existindo.

A mudança foi feita nas duas versões do servidor.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `web/ApiServer.java` | `/api/inicio`, `resumo=1`, rota da miniatura, `thumbUrl` nas listas |
| `web/MangaResponse.java` | Campo `thumbUrl` e a versão resumida |
| `service/ImagemService.java` | Guardar, listar e apagar miniaturas |
| `repository/ImagemRepository.java` e as duas implementações | Listar nomes por final, sem ler o conteúdo |
| `api/index.js` | O mesmo, na versão JavaScript |
| `public/app.js` | Início em uma chamada, lista guardada, busca e filtros locais, miniaturas, capas reduzidas no envio, capas adiantadas e recarregar a aba |
| `public/app.css` | Tela apagada enquanto recarrega e espaço reservado das capas |

## Testes

- Java (278 no total, 6 a mais): miniatura guardada sem mudar a capa, uma só por capa, recusa de miniatura
  inválida, miniatura apagada junto com a capa, `/api/inicio` com e sem login, lista resumida, rota da miniatura e
  `thumbUrl` nas listas, e a listagem de nomes no Postgres.
- JavaScript: 52 testes, sem mudança. As rotas novas da versão do Vercel foram exercitadas pelo navegador no
  ambiente de medição (início, lista resumida, criação de 120 miniaturas).
- No navegador: busca e filtros iguais aos do servidor em cinco combinações, nenhuma chamada ao servidor durante a
  busca e os filtros, recarregar nas quatro abas, lista atualizada depois de marcar capítulo pelo diálogo,
  miniatura e depois capa inteira na página do mangá, capa reduzida no cadastro e o fluxo de login.

## O que ficou de fora

- Reduzir as capas originais já guardadas. Elas continuam como foram enviadas; só ganham miniatura.
- Miniaturas para capas que são links de outros sites.
- Guardar a lista entre uma visita e outra (hoje ela é guardada enquanto a página está aberta).
