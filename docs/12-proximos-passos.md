# 12 · Próximos passos

O que o sistema ainda não faz, o que está frágil e o que pode ser adicionado. Nada aqui está em andamento.

## Limitações conhecidas

**Conta única.** Um usuário e uma senha para tudo. Não há contas separadas nem listas por pessoa.

**Sites com proteção contra robôs.** A verificação automática não funciona neles. O caminho é a extensão ou o
favorito, que dependem de o usuário estar no navegador.

**Extensão.**
- Não foi testada no Firefox, no Opera GX nem nos sites protegidos.
- No Firefox ela é temporária até ser assinada.
- Só acha o próximo capítulo quando o site usa um link comum.

**Duas versões do servidor.** Toda regra precisa ser alterada em Java e em JavaScript. A versão JavaScript tem
menos testes automáticos.

**Serviços de terceiros.** O AniList limita os pedidos por minuto, a tradução tem cota diária, e a busca é pelo
nome, então obras de nomes parecidos podem trazer a descrição ou a capa errada.

**Marcar como lido.** Se o usuário lê vários capítulos direto no site e só depois muda o número, o endereço exato
se perde em sites com id por capítulo.

**Tags que o AniList não tem.** São ignoradas na busca externa.

**Capas enviadas e não usadas.** Uma capa enviada em um cadastro que foi abandonado fica guardada sem dono.

## O que pode ser adicionado

### Contas e compartilhamento
- Cadastro de usuários, com uma lista por pessoa.
- Uma página pública só de leitura, para mostrar a lista a outras pessoas.
- Sessão com cookie no lugar do HTTP Basic, com limite de tentativas de senha.

### Leitura
- Refazer o ajuste perdido da extensão: clicar em botões de "próximo" que não são links, e mostrar ao usuário o
  que a página tinha quando nada foi encontrado.
- Marcar como lido sem confirmação quando o mangá é reconhecido com certeza.
- Histórico de leitura: quando cada capítulo foi lido.
- Aviso de capítulo novo, conferindo periodicamente os mangás em leitura nos sites que permitem.
- Ver os lançamentos de outros dias da semana, e não só de hoje.

### Lista
- Nota e comentário pessoal por mangá.
- Ordenar por data da última leitura.
- Filtrar por várias tags ao mesmo tempo na página principal.
- Importar e exportar a lista, e importar de MyAnimeList ou AniList.
- Limpeza das capas sem uso.

### Descoberta
- Escolher se o que já está na lista é escondido ou só marcado.
- Lembrar obras recusadas, para não sugeri-las de novo.
- Mapear mais tags para os nomes que o AniList usa.

### Projeto
- Levar para o repositório os roteiros de teste da versão JavaScript e os de navegador.
- Rodar os testes automaticamente a cada push.
- Decidir por uma só versão do servidor. Hospedar a versão Java onde ela roda eliminaria a duplicação; manter só a
  JavaScript eliminaria o uso local sem banco.
- Assinar a extensão na Mozilla para instalação permanente no Firefox.
- Apagar o `fly.toml`.
