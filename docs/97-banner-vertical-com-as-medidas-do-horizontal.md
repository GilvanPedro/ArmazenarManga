# 97 · Banner vertical com as medidas do horizontal, trocadas

A pedido do dono, o banner vertical passou a ter **as medidas opostas às do horizontal**, ou seja, é o horizontal em
pé:

| | Largura | Altura | Proporção | Exemplos |
|---|---|---|---|---|
| Horizontal | 300 a 4000 px | 50 a 2000 px | largura de 2 a 11 vezes a altura | 1280 × 400, 970 × 250, 728 × 90 |
| Vertical (antes) | 100 a 2000 px | 250 a 4000 px | altura de 1,5 a 5 vezes a largura | 400 × 1280, 300 × 600, 160 × 600 |
| **Vertical (agora)** | **50 a 2000 px** | **300 a 4000 px** | **altura de 2 a 11 vezes a largura** | **400 × 1280, 250 × 970, 90 × 728** |

No código, o vertical é montado a partir do horizontal (`largura` e `altura` trocadas, mesma proporção), então mudar
o horizontal muda os dois.

O que muda na prática: um vertical pode ser bem mais fino e comprido (até 11 vezes, como 90 × 728), e um "quase
quadrado" de 1,5 a 2 vezes (como 300 × 450) não serve mais. As imagens já guardadas não são conferidas de novo; a
regra vale para imagens novas. 400 × 1280, 300 × 600 e 160 × 600 continuam servindo.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | `FORMATOS_DE_BANNER`: o vertical com as medidas do horizontal trocadas |
| `test-api/banners.test.mjs` | Cada medida do horizontal, trocada, serve para o vertical; 300 × 450 e 40 × 400 não servem |

## Como foi testado

Os 101 testes passam. A janela do cadastro e a conferência das medidas no navegador usam as mesmas regras (vêm do
servidor), então já mostram as medidas novas.
