# 130 · Extensão e atalho centralizada, com os banners dos lados

A aba **Extensão e atalho** da Biblioteca tinha o texto encostado à esquerda e dois banners verticais numa coluna ao
lado dele. Em telas estreitas, aparecia só um horizontal embaixo do texto.

Agora:

- **o texto fica no meio da tela**, com a mesma largura de antes (boa para ler);
- **na tela grande**, um banner **vertical de cada lado**, como na Comunidade, no Descobrir e na Loja. Eles ficam nos
  trilhos laterais, presos na tela enquanto se rola o texto ([doc 91](91-lugares-de-banner.md));
- **no celular e em telas sem espaço dos lados**, um banner **horizontal em cima** do texto e **outro embaixo**.

Testado a 1440 px e 1024 px (um vertical de cada lado) e a 390 px (horizontal em cima e embaixo), sem a página rolar
para o lado.

## Lugares de banner

| Lugar | Nome nos relatórios |
|-------|---------------------|
| `atalho-esquerda` | Extensão e atalho, lateral esquerda (novo) |
| `atalho-direita` | Extensão e atalho, lateral direita (novo) |
| `atalho-topo` | Extensão e atalho, em cima do texto (novo) |
| `atalho-fim` | Extensão e atalho, embaixo do texto (já existia) |

Os lugares antigos `atalho-1` e `atalho-2` (os dois verticais da coluna) não aparecem mais no site, mas continuam na
lista do servidor, para os relatórios dos meses passados mostrarem o nome deles.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | `telaAtalho` com o texto no meio, os trilhos dos lados e os horizontais em cima e embaixo |
| `public/app.css` | `.texto-do-atalho` centralizado; saiu o estilo da coluna antiga |
| `api/_banners.js` | Os lugares novos da Extensão e atalho |
