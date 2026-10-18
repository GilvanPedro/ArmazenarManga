# 98 · O "+ Adicionar" dos recomendados alinhado

Na página do mangá, em "Parecidos com este, para ler depois", o botão **+ Adicionar** de cada obra ficava em alturas
diferentes: logo abaixo do título e das tags, que ocupam uma linha, duas ou nenhuma, conforme a obra.

Agora o botão fica sempre no pé do cartão (`margin-top: auto` no último botão do `.cartao`). Como os cartões de uma
mesma linha da grade têm a mesma altura, todos os botões da linha ficam no mesmo nível. A regra vale para qualquer
cartão com um botão no fim, então o Descobrir (que tem o mesmo "+ Adicionar") também fica alinhado.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.cartao > .botao:last-child { margin-top: auto; }` |

## Como foi testado

No navegador, com seis recomendações de títulos e tags de tamanhos diferentes (título curto e de duas linhas; uma,
duas, três ou nenhuma tag): a 1550 px, os seis botões na mesma altura; a 390 px, os três de cada linha na mesma altura.
Os testes passam.
