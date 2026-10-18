# 75 · Otimização geral do site

Uma revisão do site para deixá-lo mais rápido, feita em outubro de 2026. Antes de mudar, foi medido o que pesava; as
mudanças valem para todas as partes (Biblioteca, Comunidade, Loja, Gerenciar dos admins e do dono).

## O que foi medido

- Todo visitante baixava o `app.js` (293 KB, 78 KB comprimido) e o `app.css` (137 KB, 29 KB comprimido) do jeito que
  estão no projeto, com todos os comentários, e o navegador lia o arquivo inteiro a cada abertura.
- Esses arquivos iam com `Cache-Control: max-age=0`: a cada abertura do site, o navegador perguntava de novo se tinham
  mudado.
- A cada instância nova da função do Vercel (as "partidas a frio"), o servidor rodava o script inteiro de criação das
  tabelas e procurava, lendo a tabela `mangas` toda, mangás sem as colunas de busca. No banco local, a primeira chamada
  levava 65 ms contra 6 ms das seguintes; no Neon, que fica em outro servidor, isso pesa mais.
- Cada abertura do site com login fazia duas idas ao banco para contar o acesso e marcar a conta como ativa.

## O que mudou

### 1. O site compactado no Vercel

Um passo de montagem (`ferramentas/construir-site.mjs`, o `buildCommand` do `vercel.json`) gera a pasta
`.saida-vercel`, que é a que vai para o ar:

- copia `src/main/resources/public` como está;
- compacta o `app.js` e o `app.css` com o **esbuild** (sem comentários nem espaços, e os nomes de dentro das funções
  encurtados), e põe no nome um pedaço do hash do conteúdo (`app-9675f12cca.js`);
- troca no `index.html` os endereços pelos novos.

| Arquivo | Antes | Depois | Comprimido, antes → depois |
|---------|-------|--------|---------------------------|
| `app.js` | 285 KB | 155 KB | 75 KB → 48 KB (−35%) |
| `app.css` | 134 KB | 104 KB | 29 KB → 22 KB (−24%) |

Como o nome muda sempre que o arquivo muda, o `vercel.json` manda guardar os `app-*` por **um ano**
(`immutable`): depois da primeira visita, o navegador nem pergunta mais por eles, e uma versão nova chega sozinha
porque o `index.html` (que continua sem cache) aponta para o nome novo.

O código do projeto continua legível em `src/main/resources/public`: só o que vai para o ar é compactado. A versão Java
serve a pasta original, sem a montagem. Para montar localmente: `npm run construir`. O esbuild entrou como
dependência de desenvolvimento (só é usado na montagem, não vai para a função).

### 2. A estrutura do banco só quando muda

O servidor guarda na tabela `configuracoes` a **versão da estrutura** (`versao_da_estrutura`, um resumo do texto que
cria as tabelas). Ao começar, ele lê essa linha: se é a versão do código, não roda nada; se mudou (alguém mexeu numa
tabela, coluna ou índice no código), roda o script e a procura das colunas de busca, e guarda a versão nova. No banco
local, a primeira chamada de uma instância nova caiu de **65 ms para 36 ms**. Para forçar o script de novo, basta
apagar essa linha.

### 3. O acesso contado numa ida ao banco

Contar o acesso do dia e marcar a conta como ativa viraram **um comando só** (`registrarAcesso`, em
`api/_painel.js`), em vez de dois. Os números do Painel continuam iguais.

### 4. Índice para as vendas

Um índice em `compras (status, atualizada_em)`, que as Finanças e o Painel usam para somar as vendas por mês.

### 5. Fundos animados mais leves

As camadas que se mexem nos temas animados (Aurora, Noite estrelada, Sakura ao vento, Synthwave, Galáxia e Fazenda,
e os meteoros) ganharam `will-change`: viram uma camada própria na placa de vídeo, que o navegador desenha uma vez (com
o desfoque da aurora e da nebulosa) e depois só move, sem redesenhar a página a cada quadro.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `ferramentas/construir-site.mjs` | Novo: a montagem do site para o Vercel |
| `vercel.json` | `buildCommand`, a pasta `.saida-vercel` e o cache de um ano dos `app-*` |
| `package.json` | O esbuild e o comando `npm run construir` |
| `.gitignore` | A pasta `.saida-vercel` |
| `api/index.js` | A versão da estrutura (`prepararEstrutura`) |
| `api/_painel.js` | O acesso e a atividade num comando só |
| `api/_loja.js` | O índice das vendas |
| `public/app.css` | `will-change` nas camadas animadas |

## Como foi testado

- O site montado (o mesmo que vai para o ar) foi aberto num servidor local, e um teste passou por **19 telas**: a
  entrada sem login (com as capturas), a Biblioteca, Lançam hoje, Descobrir, Extensão e atalho, Adicionar, a
  Comunidade (Para você, Seguindo, a busca e um perfil), a Loja (Bordas, Efeitos, Temas e a Mochila com filtro), o
  Gerenciar (Painel, Finanças, Imagens da loja, Contas e Registro) e as Configurações, sem nenhum erro. O código do
  favorito (bookmarklet) continuou válido, e curtir um post continuou funcionando.
- A estrutura: a primeira partida guardou a versão e criou o índice novo; as seguintes só leram a linha.
- O acesso: uma abertura sem conta, duas com conta e uma do Googlebot deram 1 sem conta, 2 com conta e 1 ativo.
- Os 88 testes da versão JavaScript passam.
