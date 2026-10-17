# 68 · Mais efeitos e o filtro da mochila

Dois ajustes na loja (veja [Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md) e
[Temas do site](67-temas-do-site.md)), feitos em outubro de 2026.

## Seis efeitos novos

A **R$ 2,50** cada, como os outros; com eles, a loja tem **11 efeitos**.

| Id | Nome | Como é |
|----|------|--------|
| `brasas` | Brasas | Brasas acesas subindo e piscando pela capa, com um calor laranja que vem de baixo |
| `chuva` | Chuva | Riscos finos de chuva caindo na diagonal, com a capa um pouco azulada |
| `coracoes` | Corações | Coraçõezinhos rosa subindo e sumindo (um coração e as sombras do texto fazendo os outros, em lugares e cores diferentes) |
| `glitch` | Glitch | Faixas de cor que aparecem e pulam de lugar de vez em quando, como uma tela com defeito |
| `crt` | Tela CRT | As linhas de uma TV antiga, os cantos escurecidos e uma faixa de luz descendo, com uma leve tremida |
| `confete` | Confete | Retalhos coloridos caindo e girando de leve |

Como os outros efeitos, ficam na camada `::before` da capa dos favoritos, convivem com qualquer borda e ficam parados
para quem pede para o sistema reduzir animações. Nas bordas ornamentadas (que deixam os enfeites saírem da capa),
os corações podem subir um pouco para fora dela.

## Filtro da mochila

A **Mochila** ganhou um filtro em cima dos itens: **Todos**, **Bordas**, **Efeitos** e **Temas**, cada um com a
quantidade entre parênteses (contando os de sempre: a borda Roxa, o Brilho e os temas Automático, Escuro e Claro).

- O filtro fica no endereço (`#/loja/mochila?tipo=borda`, `?tipo=efeito` ou `?tipo=tema`): voltar ou recarregar a
  página mantém o filtro, e as páginas da mochila também (`?tipo=efeito&pagina=2`).
- Trocar o filtro volta para a primeira página.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os 6 efeitos novos |
| `public/app.css` | Os 6 efeitos; o filtro da mochila centralizado |
| `public/app.js` | O filtro da mochila (`?tipo=`) e as páginas guardando o filtro |

## Como foi testado

- Os 87 testes da versão JavaScript passam (eles conferem que todo efeito custa R$ 2,50 e que nenhum id se repete).
- No navegador, com a conta de exemplo (dona do site, então com todos os itens): a aba Efeitos com os 11 efeitos; na
  mochila, os botões "Todos (38)", "Bordas (14)", "Efeitos (12)" e "Temas (12)", e cada um mostrou só itens do tipo
  dele, com o endereço mudando para `?tipo=...`.
