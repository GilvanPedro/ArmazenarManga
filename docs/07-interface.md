# 07 · Interface

## Como é feita

HTML, CSS e JavaScript puros, em quatro arquivos dentro de `src/main/resources/public`. Não há framework,
biblioteca nem etapa de build: o que está no repositório é o que o navegador recebe.

- **Página única.** O `index.html` tem só o topo e um espaço vazio. O `app.js` desenha cada tela nesse espaço.
- **Rotas pelo `#` do endereço.** `#/`, `#/hoje`, `#/descobrir`, `#/manga/{id}`, `#/novo`, `#/editar/{id}`,
  `#/tag/{nome}`, `#/capturar?…` e `#/atalho`. Voltar e avançar do navegador funcionam normalmente.
- **Texto sempre como texto.** Uma função auxiliar cria os elementos, e todo conteúdo vindo de fora entra como
  texto, nunca como HTML.
- **Tema claro e escuro**, seguindo o sistema. As cores são variáveis no topo do `app.css`.
- **Responsiva.** A grade tem no máximo 6 colunas (8 em monitores de 1800 px ou mais) e chega a 2 no celular. O site
  foi conferido em 14 tamanhos de tela, do celular ao monitor grande: veja [Responsividade](42-responsividade.md).

## Telas

O topo divide o site em duas partes: **Biblioteca** (todas as telas abaixo, menos a Comunidade e Minha conta) e
**Comunidade**. Veja [Biblioteca e Comunidade](27-biblioteca-e-comunidade.md).

### Comunidade (`#/comunidade`)

Feeds "Para você" e "Seguindo", campo de escrever no alto, botão ✎ que abre a janela de escrever, posts com imagens
e listas anexadas, curtidas, comentários, "Quem seguir" ao lado e o perfil de cada leitor
(`#/comunidade/perfil/{id}`). Veja [Comunidade](28-comunidade.md).

### Entrar

Quando o navegador não está conectado, aparece a tela de entrada no lugar de qualquer outra: e-mail, senha com
botão "Mostrar" e "Entrar", e o link para criar uma conta (nick, e-mail, senha e a senha repetida). O login vale
30 dias. Veja [Tela de login de 30 dias](20-tela-de-login.md) e [Contas de usuário](23-contas.md).

### Minha conta (`#/conta`)

Aberta pelo nick, no topo (ao lado do botão "Sair"). Escolhe a foto de perfil, edita o nick, o e-mail e a senha,
traz os mangás de antes das contas e exclui a conta, com uma janela de confirmação.

### Todos os mangás (`#/`)

A página principal. Em cima: busca por nome, seletor de ordem e botão Sortear, e embaixo deles o quadro "Tags que
quero ver" (pesquisa, várias tags, recolhível). Abaixo, os filtros de status.

Cada cartão tem a capa com o status (em cima, à esquerda) e a nota (embaixo, à direita, quando há), além da borda roxa e da estrela quando é favorito, o nome centralizado e dois botões da largura da capa: o do capítulo atual
(abre o diálogo de progresso) e o **Ler**. Para mangás concluídos, o Ler pergunta entre ler novamente e abrir o
último capítulo.

A lista é paginada de 24 em 24. Até 2 mil mangás, ela é pedida inteira uma vez e guardada no navegador, então
buscar, filtrar e trocar de página não esperam o servidor (veja [Desempenho](21-desempenho.md)). Acima disso, as
páginas vêm do servidor, já filtradas (veja [Escala e preparação para contas](22-escala-e-contas.md)). Os cartões usam a miniatura da
capa quando ela existe. Clicar na aba já aberta recarrega a lista. Buscar ou filtrar volta para a
página 1; alterar um capítulo ou abrir um mangá e voltar mantém a página. A ordem escolhida fica lembrada no
navegador.

### Lançam hoje (`#/hoje`)

Os mangás em leitura que lançam capítulo no dia. Marcar o capítulo novo de um deles o tira da lista.

### Descobrir (`#/descobrir`)

Busca geral de obras que não estão na lista: campo de nome, seletor de ordem e dois quadros de tags, "Quero com
estas tags" e "Não quero com estas tags". Cada quadro tem um campo para pesquisar a tag pelo nome (Enter marca a
primeira encontrada), a lista de todas as tags (as em uso primeiro) rolando para baixo, e as marcadas em cima,
com × para tirar. Uma tag marcada em um quadro fica travada no outro. A lista de tags começa recolhida e
abre ao pesquisar ou pelo botão "Mostrar tags"; os dois quadros abrem e recolhem juntos. Cada obra mostra capa, nome, nota, ano e gêneros. A capa abre a página no AniList, e
"+ Adicionar" abre o cadastro preenchido. A página avisa quantas obras foram escondidas por já estarem na lista
e quais tags a fonte não tem.

### Página do mangá (`#/manga/{id}`)

Capa, título, status, último capítulo, dia de lançamento, nota (um seletor que salva na hora), tags clicáveis e
descrição. O botão "☆ Favoritar" marca e desmarca o favorito. Botões: Ler, Alterar
capítulo, Edição geral, Verificar link e Excluir.

Abaixo vêm duas seções, carregadas depois do resto para não atrasar a página:

- **Na sua lista, com tags em comum.**
- **Parecidos com este, para ler depois.**

Clicar em uma tag leva à lista filtrada por ela.

### Cadastro e edição geral (`#/novo`, `#/editar/{id}`)

O formulário completo: capa (arquivo ou link, com prévia), título, link do capítulo, último capítulo, formato de
",5", status, dia de lançamento, nota, tags e descrição.

- Embaixo do link aparece um exemplo de como ficam o link do último capítulo e o do próximo.
- O dia de lançamento só fica habilitado com o status Lendo.
- As tags são escolhidas em um seletor com sugestões; uma tag nova pode ser criada na hora.
- "Buscar na internet" preenche a descrição e sugere tags.

Quando o cadastro vem de uma captura ou de uma recomendação, os campos já chegam preenchidos, com um aviso do
que conferir.

### Marcar capítulo lido (`#/capturar`)

Aberta pela extensão ou pelo favorito. Mostra o mangá reconhecido em um campo de busca com sugestões, o capítulo,
o endereço da página e, se houver, o do próximo capítulo. A lista de sugestões termina sempre com a opção de
cadastrar como mangá novo.

### Extensão e atalho (`#/atalho`)

Instruções de instalação da extensão, a situação dela (instalada, liberada) e o favorito para arrastar.

## Diálogo de progresso

O atalho para o uso do dia a dia: último capítulo com botões − e +, status e, opcionalmente, o link do capítulo
lido. Aceita `48,5` ou `48.5`. O + vai para o próximo inteiro.

## Detalhes de comportamento

- **Respostas fora de ordem.** Cada tela anota um número ao começar a carregar. Uma resposta que chega depois de
  a tela ter sido trocada é descartada.
- **Busca com espera.** Digitar na busca só dispara a consulta depois de uma pequena pausa, e uma consulta
  pendente é cancelada ao trocar de tela.
- **Avisos.** Mensagens curtas aparecem embaixo da tela e somem sozinhas.
- **Acessibilidade.** Os seletores com sugestões funcionam pelo teclado (setas, Enter, Esc) e informam o estado a
  leitores de tela. Os botões têm nome mesmo quando mostram só um símbolo.
