# 64 · Os mangás do perfil e a lista de um mangá só

Dois ajustes na Comunidade feitos em outubro de 2026 (veja [Perfil, busca e configurações](49-perfil-busca-e-configuracoes.md)
e [Comunidade](28-comunidade.md)).

## Ver os mangás de alguém pelo perfil

No perfil de qualquer pessoa (inclusive o seu), o número de **mangás** virou um botão, como os de seguidores e
seguindo. Ele abre a janela **"Mangás de {nick}"**, igual à de montar uma lista para um post, mas só para ver:

- busca pelo nome, filtro por status (Todos, Lendo, Dropado...) e a mesma ordem da Biblioteca;
- as capas vêm aos poucos (48 por vez) conforme a janela rola, com a nota e a borda de favorito da pessoa;
- **clicar numa capa** mostra o que a pessoa cadastrou daquele mangá: a capa, o **status**, a nota, se é favorito, o
  último capítulo lido, as tags e a descrição, com "← Voltar para os mangás". Fechar (× ou Esc) volta para as capas;
  nas capas, fecha a janela.

**O que fica de fora:** os links de leitura (o site onde a pessoa lê e o endereço dos capítulos) não saem do servidor.

**Isso muda a privacidade:** antes, só o número de mangás aparecia no perfil e a Biblioteca era só da pessoa (doc 49).
Agora qualquer leitor com login vê os mangás de qualquer perfil.

### As capas de outra conta

As capas enviadas são privadas da conta (`/api/imagens` só abre as da própria conta). Para o perfil, as capas saem
por `/api/comunidade/contas/{id}/capas/{nome}`, que só entrega a imagem se ela for a capa (ou a miniatura da capa) de
um mangá daquela conta: a foto de perfil e outras imagens continuam privadas. As capas de link externo aparecem
direto.

## Lista de um mangá só

Um post com uma lista de **um mangá só** passou a mostrar esse mangá: o rótulo "Mangá", o nome dele (e o título da
lista, se houver) e "Ver mangá →". Clicar abre **direto as informações dele**, sem a grade da lista nem o "← Voltar
para a lista"; o × e o Esc fecham a janela. Listas com dois ou mais mangás continuam como antes.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/contas/{id}/mangas?pagina=&titulo=&status=&ordem=` | `{ itens: [{ id, titulo, capa, miniatura, status, nota, favorito, capitulo, tags, descricao }], pagina, paginas, total }`, 48 por página |
| `GET` | `/api/comunidade/contas/{id}/capas/{nome}` | A capa (ou miniatura) de um mangá daquela conta; 404 para qualquer outra imagem |

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/index.js` | `mangasDeOutraConta` (a busca da Biblioteca na conta do perfil, sem links) e `capaDeOutraConta` |
| `api/_comunidade_rotas.js` | As duas rotas |
| `public/app.js` | O número de mangás clicável, a janela dos mangás do perfil, o detalhe do mangá separado (`detalheDoMangaDeOutro`, usado também nas listas) e a lista de um mangá só |
| `public/app.css` | O que fica escondido na janela dos mangás do perfil |

## Como foi testado

Num banco local, vendo o perfil da Bia com a conta da Ana: a API trouxe os 3 mangás (sem nenhum link), a capa saiu
pelo endereço do perfil, e a mesma capa pedida pelo perfil de outra conta deu 404. Na janela: as capas com a borda de
favorito, o detalhe com status, nota, favorito e capítulo, o Esc voltando para as capas e a busca "fri" achando só
Frieren. Um post da Bia com um mangá só mostrou "Mangá · Frieren · Ver mangá →" e abriu direto nas informações, sem
o voltar, e o × fechou a janela. Os 86 testes da versão JavaScript passam.
