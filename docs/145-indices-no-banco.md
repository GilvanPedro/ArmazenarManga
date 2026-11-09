# 145 · Índices no banco

Um índice funciona como o índice de um livro: em vez de ler a tabela inteira, o banco vai direto às linhas que
procura. Várias tabelas já tinham índices, mas algumas buscas ainda liam tudo. As estatísticas do banco de produção
mostraram, por exemplo, que a tabela `contas` tinha sido lida inteira 17 mil vezes.

## Buscas com texto no meio (trigramas)

Buscas como "%naruto%" (o texto pode estar em qualquer parte) não conseguem usar um índice comum. Para elas entra a
extensão `pg_trgm` do Postgres, que indexa pedaços de três letras:

| Índice | Usado em |
|--------|----------|
| `mangas_titulo_trigramas` | busca de mangás pelo título na biblioteca |
| `contas_nick_trigramas` | busca de pessoas pelo nick e sugestões da barra de pesquisa |
| `posts_texto_trigramas` | busca de posts, de #tags e sugestões da barra de pesquisa |

A busca de título usava `strpos(...)`, que nenhum índice atende. Agora usa `LIKE '%...%'`, com `%`, `_` e `\`
escapados, e o resultado é o mesmo. Se um dia o banco não deixar instalar a extensão, o resto da estrutura sobe
normalmente e as buscas só ficam sem esse atalho.

## Índices que faltavam

| Índice | Para quê |
|--------|----------|
| `imagens_url`, `imagens_da_comunidade_url`, `imagens_de_banner_url` | conferir se outra imagem usa o mesmo arquivo no Blob antes de apagar |
| `imagens_da_comunidade_post` | achar as imagens de um post ao apagar o post |
| `imagens_conta`, `imagens_da_comunidade_conta` | apagar os arquivos de uma conta que é excluída |
| `contas_foto` | conferir se uma imagem ainda é foto de perfil antes de apagar |
| `contas_criada`, `contas_criada_no_dia` | contas novas por dia e por mês no painel; contas recentes nas sugestões de quem seguir |
| `mochila_compra`, `moderacao_admin` | reembolso de compra e exclusão de conta de admin |

## Métricas dos banners por mês

Os relatórios filtravam o mês com `to_char(dia, 'YYYY-MM') = '2026-11'`. Isso transforma cada linha antes de
comparar, então o índice do dia não era usado. Agora o filtro é `dia >= '2026-11-01' AND dia < '2026-12-01'`, e o
banco usa o índice (o do banner, quando o relatório é de um banner só).

## Resultado

Testado num Postgres local com 20 mil contas, 50 mil mangás e 30 mil posts:

| Busca | Antes | Agora |
|-------|-------|-------|
| pessoa pelo nick | lia as 20 mil contas | 0,08 ms, pelo índice |
| título em todos os mangás | 9 ms, lendo tudo | 1,5 ms, pelo índice |
| post pelo texto | lia os 30 mil posts | pelo índice |
| métricas de um mês | lia todas as métricas | pelo índice |

Hoje as tabelas ainda são pequenas, e com poucas linhas o Postgres às vezes prefere ler tudo, porque é mais rápido.
Ele escolhe sozinho, e os índices passam a valer conforme o site cresce. Depois de criar os índices, a estrutura roda
um `ANALYZE` para o banco atualizar as contagens que usa nessa escolha.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | bloco `INDICES` (extensão `pg_trgm` e os índices novos); busca de título com `LIKE` |
| `api/_banners.js` | métricas do mês filtradas por intervalo de datas |

Os índices são criados sozinhos no primeiro acesso depois do deploy, junto com o resto da estrutura.
