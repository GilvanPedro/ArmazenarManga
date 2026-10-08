# 08 · Extensão e atalho

O site não consegue ler páginas de outros sites, e o servidor é barrado pelos que têm proteção contra robôs.
O navegador de quem está lendo consegue. A extensão e o favorito existem para aproveitar isso.

## A extensão

Fica na pasta `extensao/` e funciona em Chrome, Edge, Brave, Opera GX e Firefox.

| Arquivo | Papel |
|---------|-------|
| `manifest.json` | Declaração da extensão (Manifest V3) |
| `fundo.js` | Parte em segundo plano: abre abas, lê as páginas e guarda as permissões |
| `conteudo.js` | Roda nas páginas: liga o site à extensão e mostra o botão "✓ Lido" |
| `popup.html`, `popup.js`, `popup.css` | Janelinha do ícone |

### O que ela faz

**No botão Ler.** O site pede ao servidor a verificação do link. Se o servidor foi barrado, a extensão abre o
último capítulo lido em uma aba, espera a tela de verificação do site passar, procura o link do próximo capítulo,
leva a aba até ele e devolve os dois endereços ao site, que os salva.

**Marcar como lido.** De três jeitos:
- o botão **✓ Lido**, que aparece no canto das páginas dos sites onde há mangá cadastrado;
- o **ícone** da extensão, em qualquer site;
- o teclado, **Alt+Shift+L**.

Os três abrem a tela "Marcar capítulo lido" do site, com os dados da página.

### Permissão

A extensão só obedece ao site que o dono liberar. Para liberar, abre-se o site, clica-se no ícone da extensão e
em "Permitir que este site use a extensão". Pedidos de qualquer outra página são recusados, mesmo que ela
imite o site. A lista de sites de leitura onde o botão aparece é informada pelo próprio site, a partir dos links
dos mangás cadastrados.

### Instalação

**Chrome, Edge, Brave ou Opera GX**
1. Abrir a página de extensões (`chrome://extensions`, `opera://extensions`…) e ligar o modo do desenvolvedor.
2. "Carregar sem compactação" e escolher a pasta `extensao`.
3. Abrir o site, recarregar, clicar no ícone da extensão e permitir.

Instalada assim, ela permanece. Depois de atualizar os arquivos, é preciso clicar em recarregar no cartão dela.

**Firefox**
1. Abrir `about:debugging#/runtime/this-firefox` e clicar em "Carregar extensão temporária".
2. Escolher `extensao/manifest.json`.

Carregada assim, ela sai ao fechar o Firefox. Para ficar permanente, a extensão precisa ser assinada pela
Mozilla, o que é gratuito mas exige uma conta no site de complementos deles. Esse passo ainda não foi feito.

## O favorito

Para quem não quer instalar a extensão. Na aba "Extensão e atalho" há um botão para arrastar até a barra de
favoritos. Clicado na página de um capítulo, ele pega o endereço, os títulos da página, a capa e o link de
"próximo", e abre a tela "Marcar capítulo lido".

No celular, onde não dá para arrastar, o código pode ser copiado e colado como endereço de um favorito. Outra
saída é colar o link do capítulo no diálogo de alterar capítulo.

## O que foi testado e o que não foi

Testado em um Chromium de verdade, com sites de leitura simulados (incluindo um com id por capítulo, botões
montados por JavaScript e tela de "Just a moment…") e em uma página real de capítulo de um site aberto.

Não testado: o Firefox, o Opera GX e os sites que bloqueiam acesso automático, porque só o navegador do próprio
usuário consegue abri-los. Nesses, dois pontos podem falhar: o navegador não deixar o favorito rodar na página, e
o botão de próximo do site não ser um link comum.
