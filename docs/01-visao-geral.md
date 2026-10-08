# 01 · Visão geral

## O que é

O Meus Mangás é um site pessoal para acompanhar mangás, manhwas e webtoons. Ele guarda o que está sendo lido,
em que capítulo a leitura parou e em qual site cada obra é lida, e leva direto ao próximo capítulo.

A ideia que o diferencia de catálogos como MyAnimeList e AniList é partir do **lugar onde a leitura acontece**:
cada mangá tem o link do site de leitura, e o sistema cuida de manter esse link funcionando.

## O que ele faz

**Lista de mangás**
- Cadastro com capa (arquivo enviado ou link), título, último capítulo lido, status, tags, descrição e dia de lançamento.
- Seis status: Lendo, Dropado, Cancelado, Concluído, Hiatus e Para Ler.
- Busca por nome, filtro por status e por tag, seis formas de ordenar e paginação de 24 por página.
- Sorteio de um mangá qualquer, respeitando o filtro de status selecionado.

**Leitura**
- Botão **Ler**, que abre o próximo capítulo não lido no site salvo.
- Mangás concluídos oferecem "ler novamente" (capítulo 1) ou abrir o último capítulo.
- Verificação do link: o servidor confere se o próximo capítulo existe e corrige o link quando o site muda o endereço.
- **Marcar como lido** direto da página do capítulo, por uma extensão de navegador ou um favorito.
- Aba **Lançam hoje**, com os mangás em leitura que lançam capítulo no dia e ainda não foram lidos.

**Descoberta**
- Descrição em português e tags buscadas na internet ao cadastrar.
- Na página de cada mangá: semelhantes da própria lista (por tags) e recomendações de fora (pelo título e pelas tags).
- Aba **Descobrir**: busca geral por nome, tags e ordem, sem repetir o que já está cadastrado.

## Limites de hoje

- **Uso individual.** Existe uma única conta (um usuário e uma senha, definidos na configuração). Quem entra vê e
  altera todos os mangás. Não há cadastro de usuários nem listas separadas por pessoa.
- **Sites com proteção contra robôs.** O servidor não consegue abrir páginas de sites que exigem um navegador de
  verdade (por exemplo, os que usam o desafio do Cloudflare). Neles a verificação automática não funciona, e o
  caminho é a extensão ou o favorito. Veja [05 · Links e leitura](05-links-e-leitura.md).
- **Dependência de serviços de terceiros.** Descrições, recomendações e nomes alternativos vêm do AniList, do
  MangaDex e do MyMemory. Se um deles estiver fora do ar, essas partes ficam vazias, mas o resto do site funciona.
- **Duas versões do servidor.** A lógica existe em Java e em JavaScript, e as duas precisam ser mantidas iguais.
  Veja [02 · Arquitetura](02-arquitetura.md).

A lista completa de limitações e ideias está em [12 · Próximos passos](12-proximos-passos.md).
