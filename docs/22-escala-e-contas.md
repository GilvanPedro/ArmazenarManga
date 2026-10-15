# 22 · Escala para milhares de mangás e preparação para contas

Mudança feita em outubro de 2026 para o site aguentar 5 mil mangás ou mais, cadastrados por pessoas diferentes,
e para deixar o banco pronto para o cadastro de contas, que virá depois: cada pessoa com os próprios mangás, sem
ver os das outras.

O cadastro de contas em si **não foi feito**. Continua existindo uma conta só, mas tudo o que é guardado já tem
dono, e toda consulta já filtra pelo dono.

## O que impedia a escala

- Quase toda tela pedia ao banco **a tabela inteira**, com as descrições, e filtrava, ordenava e cortava a página
  na memória do servidor. Com 5 mil mangás, cada abertura da lista tiraria do banco uns 10 MB.
- O mesmo acontecia para a lista de tags, os lançamentos do dia, os mangás parecidos, o sorteio e a lista de
  nomes usada nas recomendações.
- Para achar as miniaturas, o servidor lia o nome de todas as imagens guardadas.
- Os registros não tinham dono.

## O que mudou no banco

As tabelas ganharam colunas e índices. A mudança **só acrescenta**: nenhum dado é apagado nem alterado, e ela roda
sozinha na primeira chamada depois da atualização, nas duas versões do servidor.

| Tabela | Coluna nova | Para que serve |
|--------|-------------|----------------|
| `mangas` | `conta` | De quem é o mangá. Os mangás que já existiam ficam na conta `principal` |
| `mangas` | `titulo_busca` | O título em minúsculas e sem acentos, para buscar e ordenar sem abrir o JSON |
| `mangas` | `tags_busca` | As tags do mangá, do mesmo jeito, para filtrar por tag |
| `imagens` | `conta` | De quem é a capa |

| Índice | Usado em |
|--------|----------|
| `(conta, ordem)` | Lista na ordem de cadastro e mais recentes |
| `(conta, titulo_busca)` | Ordem por título |
| `(conta, status)` | Filtro de status, lançamentos do dia |
| `(conta, imagePath)` | Saber se uma capa ainda está em uso antes de apagar |
| `tags_busca` (GIN) | Filtro por tag e mangás parecidos |

- `titulo_busca` e `tags_busca` são preenchidas a cada gravação. Os mangás que já existiam são preenchidos uma vez,
  na primeira chamada, de 500 em 500.
- Uma trava no banco impede que duas cópias do servidor façam a mudança ao mesmo tempo.
- As duas versões do servidor criam exatamente a mesma estrutura e normalizam os textos do mesmo jeito. Foi
  conferido com as duas apontando para o mesmo banco: um mangá cadastrado pelo Java é achado pela busca do
  Vercel, um login feito em uma vale na outra, e as listas saem iguais.

## O que mudou nas consultas

### A lista é feita pelo banco

Busca por nome, filtro de status, filtro de tag, as nove ordens e a paginação passaram a ser feitos **pelo
Postgres**. Só a página pedida sai do banco. As ordens seguem as mesmas regras de antes (sem nota no fim,
empates pelo título, favoritos primeiro e o resto na ordem de cadastro). Para garantir isso, um teste compara a
lista do banco com a feita em memória nas nove ordens, com vários filtros e páginas.

### Toda consulta filtra pela conta

Mangás e capas de outra conta não aparecem em lista nenhuma, não abrem pelo endereço (respondem 404), não podem
ser apagados e não podem ser sobrescritos, mesmo usando o mesmo id. A conta de quem está usando vem de um ponto
só em cada versão (`contaAtual()` no Vercel; o repositório recebe a conta no Java). Hoje esse ponto devolve
sempre `principal`; quando houver contas, ele passa a vir da sessão.

### As outras telas pedem só o que usam

| Tela ou função | Antes | Agora |
|----------------|-------|-------|
| Lista de tags | Todos os mangás | Só as tags da conta |
| Lançam hoje | Todos os mangás | Só os que estão sendo lidos e lançam no dia |
| Parecidos na lista | Todos os mangás | Só os que dividem alguma tag, já contados e ordenados pelo banco |
| Sorteio | Todos os mangás | Um, sorteado pelo banco |
| Nomes para as recomendações | Todos os mangás | Só títulos, outros nomes e links |
| Miniaturas | O nome de todas as imagens | Só as das capas que vão aparecer |
| Sites para a extensão | A lista inteira, no navegador | Rota nova `GET /api/sites`, só os endereços |
| Tela de marcar capítulo | A lista inteira | A lista sem as descrições |

Na versão Java, a lista principal é feita pelo banco; as outras telas continuam lendo os mangás da conta e
filtrando na memória. A versão usada no dia a dia é a do Vercel.

## O que mudou no site

A lista guardada no navegador, que deixa a busca instantânea, passou a ter um limite:

- **Até 2 mil mangás na conta**: tudo como antes. A lista inteira vem uma vez e a busca, os filtros e as páginas
  não esperam o servidor.
- **Mais de 2 mil**: a busca, os filtros, a ordem e as páginas são pedidos ao servidor, que devolve só a página
  aberta, já filtrada. A busca espera o usuário parar de digitar por um quarto de segundo. Páginas já vistas
  ficam guardadas (voltar a uma delas é instantâneo), e a próxima página é pedida antes, com o navegador parado.

O site descobre em qual dos dois casos está **numa chamada só**: ele pede a lista com `inteiraAte=2000`, e o
servidor manda a lista inteira se ela couber, ou só a primeira página se não couber.

## Resultado medido

Mesmo ambiente de [Desempenho](21-desempenho.md): a função do Vercel com 150 ms de atraso por chamada, rede de
25 Mbps com 60 ms de ida e volta e respostas compactadas, como no Vercel. As capas eram links de outro site, de
cerca de 210 KB cada (sem miniatura), o caso mais pesado.

| Ação | Conta com 1.200 mangás (6 mil no banco) | Conta com 5 mil mangás (9.800 no banco) |
|------|------:|------:|
| Abrir o site | 0,9 s | 0,8 s |
| Buscar "tower" | 1,0 s | 1,2 s |
| Apagar a busca | 0,1 s | 0,3 s |
| Filtrar por status | 0,6 s | 0,8 s |
| Voltar para "Todos" | 0,07 s | 0,08 s |
| Ir para a página 2 | 0,3 s | 0,07 s |
| Trocar a ordem | 0,3 s | 0,2 s |
| Abrir um mangá | 0,2 s | 0,2 s |
| Voltar para a lista | 0,04 s | 0,02 s |

O tempo é contado até todos os mangás e todas as capas visíveis estarem desenhados; a maior parte dele é a
chegada das capas. No banco, a consulta de uma página com busca levou cerca de 1 ms.

A lista inteira de uma conta com 2 mil mangás tem 1,3 MB, mas chega compactada com uns 130 KB.

## Ao publicar

Na primeira chamada depois de publicar, o servidor acrescenta as colunas e os índices e preenche as colunas de
busca dos mangás que já existem. Com algumas centenas de mangás, isso leva menos de um segundo. Como isso mexe no
banco de verdade, vale criar antes uma cópia do banco no painel do Neon (*Branches*), por precaução.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | Estrutura do banco, conta em todas as consultas, lista pelo banco, `inteiraAte`, `/api/sites`, consultas enxutas |
| `repository/EstruturaDoBanco.java` | Novo: a mesma estrutura do banco, criada pela versão Java |
| `repository/ConsultaDeMangas.java`, `PaginaDeMangas.java` | Novos: o pedido da lista (filtros, ordem, pedaço) e a resposta |
| `repository/MangaRepository.java` | `consultar` e `contar`, feitos em memória por padrão |
| `repository/PostgresMangaRepository.java` | Conta, colunas de busca e a lista feita pelo banco |
| `repository/PostgresImagemRepository.java`, `ImagemRepository.java`, `ArquivoImagemRepository.java` | Conta nas capas e busca de miniaturas só pelos nomes pedidos |
| `domain/OrdemDaLista.java` | As formas de ordenar, que estavam dentro do `ApiServer` |
| `service/MangaService.java`, `MangaServiceInterface.java`, `ImagemService.java` | `consultar`, `contar` e miniaturas por capa |
| `web/ApiServer.java`, `web/MangaResponse.java` | Lista pelo banco, `inteiraAte`, `/api/sites`; a lista resumida mantém os outros nomes |
| `public/app.js` | Lista guardada até 2 mil mangás e, acima disso, páginas do servidor guardadas e adiantadas |

## Testes

- Java (283 no total, 5 a mais): cada conta só vê e mexe nos próprios mangás e capas; a lista do banco é igual à
  feita em memória em todas as ordens, com filtros e páginas; um banco no formato antigo ganha as colunas novas
  sem perder nada, e preparar de novo não muda nada; `inteiraAte` com e sem os filtros; `/api/sites`.
- JavaScript: 52 testes, sem mudança. A versão do Vercel foi conferida com 6 mil e 9.800 mangás no banco: as nove
  ordens com quatro filtros comparadas à regra antiga, o isolamento entre contas, a migração de um banco no
  formato atual de produção e as duas versões no mesmo banco.
- No navegador, com 5 mil mangás: login, busca, filtro, página 2, ordem, voltar e recarregar pela aba, sempre
  iguais ao que o servidor devolve.

## O que falta para as contas

- Tela e rota de cadastro, e a tabela de contas (nome, senha guardada com hash).
- A sessão passar a dizer de qual conta é, e `contaAtual()` ler isso dela.
- O limite de tentativas de login por conta.
- Decidir o que fazer com as variáveis `MANGATRACKER_USUARIO` e `MANGATRACKER_SENHA`, que hoje são o login da
  conta `principal`.

## Para crescer ainda mais

- Com dezenas de milhares de mangás por conta, a busca por parte do nome vai precisar de um índice de trigramas
  (`pg_trgm`). Até lá, o índice por conta já reduz a busca aos mangás de uma pessoa.
- As capas enviadas ficam dentro do banco. Com muitas pessoas, elas devem ir para um serviço de arquivos (como o
  Vercel Blob ou o S3), deixando o banco só com os dados.
