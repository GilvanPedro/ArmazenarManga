## REQUISITOS FUNCIONAIS

A arquitetura utilizada será a em camadas.

Inicialmente, a ideia é criar um software que irá me permitir salvar os manhwas, mangas, webtoons e etc que eu estiver lendo. O que ele deve fazer:

1. Cadastrar um manga com imagem, título, último capítulo lido, o status dele (lendo, dropado, concluido, hiatus, quero ler)
2. Alterar apenas o ultimo capitulo lido e o status dele.
3. Edição geral do manga será uma opção separada, destinada justamente para essa edição de todas as informações cadastradas dele.
4. Salvar os arquivos em JSON.
5. Permitir buscar pelo nome de um manga salvo no software.
6. Filtrar os mangas quea aparecem pelos status dele.
7. Sistema de sorteio para encontrar um manga aleatório.
8. Salvar junto com as informações do manga o link do ultimo capítulo lido.
9. Se eu editar o ultimo capitulo lido no software, o capitulo do link vai ser alterado para esse ultimo.
10. Redirecionamento do manga para o próximo capítulo que ainda não foi lido no site salvo.
11. Cada manga salvo vai ter uma página de informações dele, onde vai ter uma descrição, colocada pelo próprio usuário, e as opções de ler (topico 10), edição geral (tópico 3) e o botão de alterar o ultimo capítulo lido (tópico 2).
12. No software, os mangas vao estar organizados lado a lado, em colunas que vão variar dependendo das dimensões da tela (a maior quantidade vai ser 6), e, exibidos nessas colunas, vai estar a imagem do manga que foi adicionada no seu cadastro, e, embaixo dela, se limitando a sua largura, vai estar o botão de editar o ultimo capítulo e ler.
13. Como sites utilizam formas diferentes de  apresentar os capítulos .5 no link, o usuário poderá escolher como isso está sendo exibido para cada manga que ele for cadastrar ou editar, com o padrão sendo o ``X-5``


## VALIDAÇÕES

1. O mangá cadastrado precisa ter um título, imagem, último capitulo lido, o status dele e o link de onde ele está sendo lido
2. O mangá pode ter um capítulo 0, que pode indicar tando que ainda não começou a ser lido, ou que ele tem o capítulo 0.
3. Mangás não podem ter capítulos negaticos.
4. A edição não pode permitir que seja salvo o manga sem o nome, status, titulo, ultimo capitulo lido, imagem dele e o link do site







