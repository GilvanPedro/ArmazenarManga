# 17 · Favorito de "marcar como lido" que não abria

Correção feita em outubro de 2026 no favorito (bookmarklet) descrito em
[Extensão e atalho](08-extensao-e-atalho.md).

## O problema

Em um site de leitura (comix.to), clicar no favorito não fazia nada: nenhuma aba abria e nenhum aviso aparecia.
O link do capítulo precisava ser colado à mão no site.

## A causa provável

O favorito terminava em um único `window.open`, sem conferir se a aba abriu. Sites de leitura com anúncios
costumam trocar ou desligar o `window.open` da página, e o navegador também pode barrar a aba nova. Nos dois
casos o favorito falhava em silêncio.

Isso é uma hipótese: a causa não foi confirmada no próprio comix.to, que só pode ser aberto em um navegador
de verdade.

## O que mudou

O favorito agora tenta três caminhos, na ordem, e só passa ao seguinte se o anterior não abrir nada:

1. Um `window.open` limpo, tirado de um quadro (`iframe`) recém-criado, que o site não teve como alterar.
2. O `window.open` da própria página.
3. Ir para o Meus Mangás **na mesma aba**. O botão de voltar do navegador devolve ao capítulo.

Além disso, qualquer erro ao ler a página aparece em um alerta ("Meus Mangas: nao consegui ler esta pagina…"),
em vez de o favorito ficar mudo.

A página "Extensão e atalho" ganhou um parágrafo explicando o que fazer quando o favorito não reage.

## É preciso trocar o favorito

O código fica guardado **dentro do favorito**, no navegador. Atualizar o site não muda os favoritos que já
existem. Para receber a correção: apagar o favorito antigo e arrastar o botão de novo, na aba "Extensão e
atalho". No celular, copiar o código de novo e colar no lugar do antigo.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `codigoDoAtalho`: os três caminhos de abertura e o alerta de erro; texto novo na tela do atalho |

## Testes

Conferido em um navegador contra páginas de teste que imitam o bloqueio: `window.open` devolvendo nada,
lançando erro, apagado, e com o quadro também bloqueado. Nos três primeiros a aba nova abre; no último o site
abre na mesma aba. Em todos, o endereço do capítulo e o do próximo chegam certos.

Não foi testado no comix.to nem no Firefox. Não há teste automático.

## Se continuar sem funcionar

- Se aparecer o alerta, a mensagem dele diz o que falhou.
- Se nada acontecer mesmo com o favorito novo, o navegador pode estar impedindo o favorito de rodar naquele
  site. Nesse caso o caminho é a [extensão](08-extensao-e-atalho.md), que não depende da página.
