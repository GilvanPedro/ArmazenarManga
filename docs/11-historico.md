# 11 · Histórico

Como o projeto chegou ao que é: o que entrou, o que mudou no caminho e o que foi removido. As datas são as dos
commits.

## Linha do tempo

### 29/09 · Planejamento

O projeto começou pelo documento [Ideia_Principal.md](Ideia_Principal.md): requisitos, validações e a estrutura
em camadas. A ideia era um programa de computador, com telas próprias.

### 02/10 · Primeira versão completa

- **Back-end em Java.** Existiam o domínio e o repositório em JSON; o serviço estava vazio e o código não
  compilava. Foram concluídos o serviço, as validações e a montagem do link a partir do modelo com `{cap}`.
- **De programa para site.** No lugar das telas de computador, entrou uma API HTTP com Javalin e um site em HTML,
  CSS e JavaScript puros, servido pelo próprio programa.
- **Capas.** Envio de imagem com validação pelo conteúdo do arquivo.
- **Login e proteções**, para poder abrir o site a outros computadores.

### 02/10 · Hospedagem

- **Fly.io** foi a primeira tentativa. Exigia cartão de crédito e o deploy não chegou a funcionar.
- **Postgres.** Hospedagens gratuitas não têm disco permanente, então os dados ganharam uma segunda forma de
  armazenamento, em banco (Neon), mantendo o arquivo JSON para uso local.
- **Render** foi configurado para rodar a versão Java.
- **Vercel** acabou sendo o escolhido. Como ele não roda Java, a API foi reescrita em JavaScript.

### 02/10 · Sorteio, concluídos e lançamentos

- Mangás concluídos passaram a oferecer "ler novamente" e "último capítulo" no lugar do "ler o próximo".
- Dia de lançamento e a aba "Lançam hoje".

### 05/10 · Links que mudam

- **Verificação de link**: o servidor abre o site de leitura, acha o próximo capítulo e corrige o cadastro.
- **Endereços exatos** por capítulo, para sites em que cada capítulo tem um id próprio.
- **Extensão de navegador e favorito**, para os sites que bloqueiam o servidor.
- **Marcar como lido** a partir da página do capítulo, com cadastro pré-preenchido para obras novas.
- **Descrição automática** em português.

### 05/10 a 06/10 · Lista grande e descoberta

- **Paginação** e nomes centralizados nos cartões.
- **Recomendações** na página do mangá.
- **Tags gerais**, com seletor no cadastro, tags clicáveis e mangás semelhantes da lista.
- **Nomes alternativos**, para não recomendar o que já está cadastrado com outro título.
- **Aba Descobrir** e **ordenação** da página principal.

### 06/10 a 08/10 · Ajustes

- A tag "Harem" passou a valer para os dois tipos que o AniList tem.
- O nome da obra passou a ser limpo de "[Manga] Manga…" e semelhantes ao marcar como lido.
- Mangás já lidos no dia saem da aba "Lançam hoje".

## O que mudou em relação ao planejamento

| Planejado | Como ficou | Por quê |
|-----------|------------|---------|
| Programa com telas (`ui/`) | Site com API | Para acessar de outros aparelhos |
| Status `QUERO_LER` | `LER`, mais `CANCELADO` | O enum já existia assim no código |
| Tags e descrição obrigatórias (no código inicial) | Opcionais | O documento de requisitos não as exigia |
| Só arquivo JSON | JSON ou Postgres | Hospedagem gratuita não tem disco permanente |
| Só Java | Java e JavaScript | A hospedagem escolhida não roda Java |
| Link montado só pelo modelo | Modelo, verificação e endereços exatos | Sites mudam o id do link |

## O que foi alterado depois de pronto

- **Sorteio.** Passou a deixar de fora concluídos e cancelados; depois voltou a incluir todos os status.
- **Campo de tags.** Era um texto separado por vírgulas; virou um seletor com sugestões e criação na hora.
- **Escolha do mangá ao marcar como lido.** Era uma lista suspensa; virou um campo de busca com sugestões.
- **Sugestão de mangá ao marcar como lido.** Comparava só o começo do endereço e sugeria errado; passou a exigir
  que a obra bata, pelo nome ou pelo endereço.
- **Exclusão de repetidos nas recomendações.** Começou comparando títulos, passou por uma consulta em memória da
  obra de cada título e terminou guardando os outros nomes junto de cada mangá.
- **Marcar como lido.** Passou a atualizar também o modelo do link, e a ler o número do capítulo do título da
  página quando o do endereço é um código interno.
- **Botões da paginação.** Aumentados.
- **Tags na aba Descobrir.** A linha de tags que rolava para o lado virou dois quadros com pesquisa, um para as
  tags pedidas e outro para as excluídas. Detalhes em [Filtro de tags no Descobrir](13-filtro-de-tags-no-descobrir.md).

## O que foi removido ou abandonado

- **Fly.io.** Abandonado. O `fly.toml` ficou no repositório sem uso.
- **Marcador `{idcapitulo}` no link.** Foi proposto para indicar onde fica o id do capítulo. Não foi implementado,
  porque o sistema descobre a posição sozinho ao comparar o link encontrado com o modelo.
- **Contornar a proteção contra robôs.** Considerado e descartado. A alternativa adotada foi ler a página no
  navegador do próprio usuário.
- **Consulta em memória das obras da lista.** Substituída pelos nomes guardados no banco, que não se perdem
  quando o servidor reinicia.
- **Verificação de link, extensão e endereços exatos.** Chegaram a ser retirados por um momento, quando não
  resolviam o caso de um site específico, e foram restaurados em seguida. Um ajuste que estava em andamento na
  extensão naquele momento se perdeu: fazê-la clicar em botões de "próximo" que não são links e mostrar o que
  encontrou quando falha. Ele está nos [próximos passos](12-proximos-passos.md).

## Problemas encontrados pelos testes

Alguns defeitos que os testes no navegador revelaram e que foram corrigidos antes de ir ao ar:

- A tela de detalhes mostrava a palavra "null" solta.
- Enviar a mesma capa duas vezes, quando o salvamento falhava por outro motivo, deixava um arquivo sem uso.
- A captura confundia um link para a página da obra com o "próximo capítulo".
- Digitar na busca e clicar logo em um mangá podia cancelar o carregamento da página dele.
- Uma capa acima do limite devolvia erro 500 em vez de uma mensagem clara.
