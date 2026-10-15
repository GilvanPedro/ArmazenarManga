# 27 · Biblioteca e Comunidade

Mudança feita em outubro de 2026: o site passou a ter duas partes principais, escolhidas no topo, ao lado do logo:
**Biblioteca** e **Comunidade**.

## As duas partes

| Parte | Endereço | O que tem |
|-------|----------|-----------|
| **Biblioteca** | `#/` e as telas da lista | Tudo o que já existia: a lista de mangás da conta (com as abas Todos os mangás, Lançam hoje, Descobrir e Extensão e atalho), a página de cada mangá, o cadastro e a edição |
| **Comunidade** | `#/comunidade` | Por enquanto, uma página "Em breve" com o que está planejado |

O nome **Biblioteca** foi escolhido por ser o acervo pessoal de cada conta: o que a pessoa lê, leu e quer ler.

### No topo

- As duas partes aparecem ao lado do logo, depois de entrar na conta. A parte aberta fica destacada.
- O botão **"+ Adicionar"** aparece só na Biblioteca, porque cadastra um mangá nela.
- A página **Minha conta** não é de nenhuma das duas, então nenhuma fica destacada nela.
- Clicar em **Biblioteca** leva à lista; se a lista já estiver aberta, recarrega (como as abas de dentro dela).
- **No celular** (até 720 px), as duas partes descem para uma linha própria, embaixo do logo e dos botões, dividindo
  a largura. Até 480 px, o logo mostra só o ícone, para os botões caberem na mesma linha.

## A página da Comunidade (por enquanto)

Mostra o selo **Em breve**, o título, um botão para voltar à Biblioteca e três cartões com o que está planejado:

- **Listas:** montar e publicar listas de mangás (os que leu, os que está lendo, os que recomenda e outras).
- **Posts:** posts curtos, no estilo do Twitter, com imagens coladas ou enviadas do computador.
- **Comentários:** comentar nos posts e nas listas publicadas.

Nada disso funciona ainda; a página só apresenta a ideia. Não houve mudança no servidor.

## O que a Comunidade vai precisar

Ideias para quando ela for feita (também em [Próximos passos](12-proximos-passos.md)):

- **Dados públicos dentro de um sistema privado.** Hoje tudo o que uma conta guarda só ela vê. Listas e posts
  publicados vão ser vistos por outras contas, então precisam de tabelas próprias (listas, itens de lista, posts,
  comentários), separadas dos mangás da Biblioteca, e de regras claras do que é público.
- **Perfil público:** nick e foto já existem; a foto hoje só pode ser vista pela própria conta e precisaria passar
  a ser pública.
- **Imagens dos posts:** colar imagem (da área de transferência) e enviar do computador, reduzindo no navegador
  como já se faz com as capas.
- **Moderação:** apagar posts e comentários, bloquear contas que abusam. A conta admin é o ponto de partida.
- **Limites:** quantos posts e comentários por minuto, tamanho das imagens.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | As duas partes no topo e o id do botão "+ Adicionar" |
| `public/app.js` | Rota `#/comunidade`, página "Em breve", parte destacada no topo |
| `public/app.css` | Estilo das partes no topo (e no celular) e da página da Comunidade |

## Testes

Conferido em um navegador: as partes não aparecem na tela de entrada; a parte certa fica destacada na lista, em
Lançam hoje, em Descobrir e na Comunidade, e nenhuma em Minha conta; "+ Adicionar" some na Comunidade; o botão
"Ir para a Biblioteca" e o clique em Biblioteca levam à lista; e o topo no celular (375 e 640 px), sem rolagem para
o lado. Não há teste automático.
