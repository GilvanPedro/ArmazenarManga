# 56 · Painel dos administradores

Uma aba nova no **Gerenciar** (veja [Moderação e robô de imagens](48-moderacao-da-comunidade.md)), feita em outubro
de 2026, para acompanhar o uso do site: acessos, usuários ativos e contas criadas. Ela é a base para, mais tarde,
gerenciar os banners de anúncios no mesmo lugar.

## Onde fica

O Gerenciar (só para admins) passou a ter três abas, e o **Painel** abre primeiro:

| Aba | Endereço |
|-----|----------|
| **Painel** | `#/gerenciar` |
| Contas | `#/gerenciar/contas` (antes era `#/gerenciar`) |
| Registro | `#/gerenciar/registro` |

## O que o painel mostra

- **Números do mês** (o mês do calendário, no horário de Brasília):
  - **Usuários ativos no mês**, o número principal, com o mês passado para comparar e os ativos de hoje e dos
    últimos 7 dias;
  - **Acessos no mês** (com o mês passado) e **acessos hoje**;
  - **Contas criadas no mês** (com o mês passado) e **contas no total**.
- **Três gráficos por dia**, de 7, 30 ou 90 dias (o botão escolhe; a escolha fica guardada enquanto a página estiver
  aberta): **usuários ativos por dia** (com a média por dia no topo, porque a mesma pessoa conta em vários dias e
  somar não faria sentido), **acessos por dia** (com o total no período; a dica de cada dia separa os acessos com
  conta e sem conta) e **contas criadas por dia** (com o total).
- **Os últimos 12 meses** numa tabela: usuários ativos, acessos e contas criadas de cada mês.

Os gráficos são colunas na cor de destaque do site, uma série cada (sem legenda: o título diz o que é). Passar o
mouse mostra o dia mais perto do ponteiro com o número; pelo teclado, o gráfico recebe o foco e as setas andam pelos
dias. Cada gráfico tem "Ver em tabela" com os mesmos números. No celular, o número principal fica em cima e os outros
dois por linha.

## O que conta como quê

- **Acesso:** cada vez que alguém abre o site (a chamada a `/api/inicio`, que o site faz ao carregar), com conta ou
  sem conta. Recarregar a página conta de novo. **Robôs não contam:** buscadores (Googlebot e outros), prévias de
  link, navegadores automáticos e programas como `curl` são reconhecidos pelo `User-Agent` e ignorados.
- **Usuário ativo:** uma conta que usou o site naquele dia: abriu o site com login ou fez qualquer coisa com login
  (a cada requisição, a conta é marcada como ativa no dia; cada instância da função grava isso só uma vez por conta
  por dia). Quem deixa o site aberto de um dia para o outro conta nos dois dias. No mês, cada conta conta uma vez.
- **Conta criada:** pela data de criação da conta (`contas.criada_em`), que já existia: esse gráfico tem o
  histórico desde o começo do site.

Acessos e usuários ativos **começam a ser contados agora**: antes desta versão o site não guardava isso. O painel
avisa desde quando há contagem.

## O que é guardado

Duas tabelas novas, criadas sozinhas no banco na primeira vez:

| Tabela | O que tem |
|--------|-----------|
| `acessos_por_dia` | Um número por dia: acessos com conta e sem conta |
| `atividade` | Uma linha por conta por dia em que ela usou o site (some quando a conta é apagada) |

**Não é guardado** IP, navegador, página visitada nem horário: só os totais do dia e em que dias cada conta usou o
site.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/gerenciamento/painel?periodo=30` | Só admins. `{ hoje, periodo, contandoDesde, numeros, porDia: [{ dia, acessos, comConta, semConta, ativos, contas }], porMes: [{ mes, acessos, ativos, contas }] }`. `periodo` aceita 7, 30 ou 90 (outro valor vira 30) |

## Próximo passo: anúncios

O painel foi feito para crescer: os banners de anúncios entram como mais uma aba do Gerenciar (cadastrar o banner, o
link e onde ele aparece, ligar e desligar) e, no Painel, com as visualizações e os cliques de cada um, usando o mesmo
tipo de contagem por dia.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_painel.js` | Novo: tabelas, contagem de acessos e de atividade, robôs, dias de Brasília e os dados do painel |
| `api/index.js` | Conta o acesso em `/api/inicio` e marca a conta ativa nas requisições com login; tabelas novas na estrutura |
| `api/_comunidade_rotas.js` | Rota `gerenciamento/painel` |
| `public/app.js` | Aba Painel (agora a primeira do Gerenciar), números, gráficos de colunas com dica e tabela |
| `public/app.css` | Estilo do painel |
| `test-api/painel.test.mjs` | Novo: robôs, dia de Brasília, períodos e dias e meses sem dados |

## Como foi testado

- Os 75 testes da versão JavaScript passam (4 novos).
- Num banco local: abrir o site com um navegador contou um acesso sem conta, e com o `User-Agent` do Googlebot não
  contou. Com 120 dias de histórico falso, o painel mostrou os números do mês, os três gráficos (7, 30 e 90 dias) e
  a tabela dos meses; a dica dos acessos mostrou o dia com e sem conta.
- No navegador, no computador (tema escuro) e no celular (390 px, tema claro), sem rolagem para o lado.

> Depois, o Gerenciar ganhou a aba **Finanças**, com os gastos, as receitas e as vendas da loja: veja
> [Finanças: ganho e perda do site](58-financas.md).

> Depois, o Painel e as Finanças passaram a ser só do dono do site (os outros admins ficam com Contas e Registro):
> veja [Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md).
