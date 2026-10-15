# 40 · Campo de tags como barra de pesquisa

Correção feita em outubro de 2026 no painel do botão **🏷 Tags** da Biblioteca (veja
[Botão de Tags na Biblioteca](37-botao-de-tags-na-biblioteca.md)).

## O que mudou

- **O campo "Pesquisar tag…" voltou a ser uma barra.** Ele aparecia como um bloco grande, de uns 240 px de altura. A
  causa era a regra da busca da Biblioteca (`.ferramentas input[type="search"] { flex: 1 1 240px }`), que também valia
  para o campo dentro do painel. Como o painel empilha as coisas na vertical, esses 240 px viravam altura. Agora o campo
  do painel tem a altura normal de uma barra de pesquisa (40 px).
- **No celular, o painel não passa mais da borda da tela.** Ele ficava preso ao botão e saía pela direita, fazendo a
  página rolar para o lado. Em telas de até 560 px, o painel ocupa a largura da barra de ferramentas.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.painel-de-tags input[type="search"]` sem o `flex` da busca; no celular, o painel preso à `.ferramentas` |

## Testes

Conferido em um navegador, no computador (1366 px) e no celular (390 px): o campo com 40 px de altura, o painel dentro
da tela e a página sem rolagem para o lado. Não há teste automático.
