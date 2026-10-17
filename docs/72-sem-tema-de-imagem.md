# 72 · Sem tema de imagem de fundo

Feito em outubro de 2026, a pedido do dono do site: o tema **Silhueta** (o único com uma imagem enviada como fundo,
veja [Tema Silhueta e o tema no perfil](70-tema-silhueta-e-tema-no-perfil.md)) **saiu da loja**, junto com o que era
só dele no `app.css` (as cores, a imagem no canto e o zoom).

- Quem tinha o Silhueta equipado volta para o **Automático**: o servidor só devolve um tema que ainda existe
  (`temaQueExiste`, em `api/_loja.js`), na sessão, na loja e no perfil. O tema não fica preso na conta, e o navegador
  troca o tema guardado assim que a conta chega.
- A imagem `silhueta.webp` continua no banco até ser apagada pela aba **Imagens da loja** do Gerenciar; nenhum item
  usa mais ela.
- Continua o que serve para as bordas: a aba Imagens da loja e a borda Celestial (veja
  [Imagens da loja no banco](63-imagens-da-loja-no-banco.md)), e a janela dos mangás do perfil com o tema da pessoa.
- Uma otimização das imagens enviadas (converter para WebP e diminuir ao enviar) chegou a ser feita e testada, mas foi
  deixada de lado a pedido do dono e não entrou.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Sem o Silhueta; `temaQueExiste` |
| `api/index.js` e `api/_comunidade_rotas.js` | A sessão e o perfil só trazem um tema que existe |
| `public/app.css` | Sem as regras do Silhueta |
| `test-api/loja.test.mjs` | Teste do `temaQueExiste` |

## Como foi testado

Os 88 testes da versão JavaScript passam (1 novo: o Silhueta vira nulo, e uma borda não passa por tema).
