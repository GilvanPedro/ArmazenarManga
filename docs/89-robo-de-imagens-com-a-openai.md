# 89 · Robô de imagens com a moderação da OpenAI

Depois do [doc 88](88-robo-de-imagens-mais-rigoroso.md), o dono pediu para o robô "realmente conseguir bloquear todos
os tipos de imagens reais de pornografia". Testando com mais imagens comuns, ficou claro o limite do modelo local:
com o limite em 60%, **4 de 320 fotos comuns eram barradas por engano** (uma moça de vestido branco no mato com 94%,
uma mão segurando um celular com 82%). Esses modelos pequenos confundem pele com nudez: qualquer limite que pega
mais pornografia também barra mais fotos comuns.

## Por que não "treinar" o robô

Treinar um classificador melhor precisaria de muitas imagens pornográficas de exemplo, e buscar esse material na
internet não é aceitável (não há como saber se as pessoas consentiram ou são maiores de idade). Também foram medidas,
com 5 imagens explícitas, 225 capas de mangá e 320 fotos comuns:

| Tentativa | Explícitas barradas | Capas barradas | Fotos comuns barradas |
|-----------|---------------------|----------------|-----------------------|
| Modelo do doc 88 (limite 60%) | 5 de 5 | 0 | 4 |
| Também a imagem espelhada | 5 de 5 | 0 | 6 |
| Também recortes (o meio e as metades) | 5 de 5 | 0 | 21 |
| Os dois modelos juntos (o maior dos dois) | 5 de 5 | 0 | 5 |
| A média dos dois modelos | 4 de 5 | 0 | 0 |

Nenhuma combinação dos modelos locais resolveu as duas coisas ao mesmo tempo.

## A solução: a moderação da OpenAI, com o modelo local de reserva

Por escolha do dono, o robô passou a perguntar para a **moderação da OpenAI** (`omni-moderation-latest`), que é
**gratuita**, olha a imagem de verdade e é bem mais precisa com fotos. Como funciona:

1. O modelo local roda sempre (é ele que diz se a imagem é desenho).
2. Com a chave da OpenAI configurada, a imagem vai diminuída (até 512 px, JPEG) para a moderação. **Se a OpenAI
   marcar a imagem como sexual (ou a nota chegar a 50%) e ela não for desenho** (desenho + desenho explícito abaixo de
   50% no modelo local), a imagem é barrada.
3. Se a OpenAI disser que não é sexual, a imagem passa, mesmo que o modelo local desconfie: isso acaba com as fotos
   comuns barradas por engano.
4. Sem a chave, ou se a OpenAI demorar mais de 8 s ou falhar, decide o modelo local, como no doc 88.

Capas de mangá e arte continuam passando, como o dono decidiu no [doc 48](48-moderacao-da-comunidade.md).

**Sobre menores de idade:** a categoria de conteúdo sexual com menores da OpenAI só vale para texto; para imagens, a
moderação dá as notas de sexual, violência e automutilação. O robô usa a de sexual.

**Privacidade:** a imagem é enviada para a OpenAI só para a verificação, dentro do pedido (não fica guardada no
Viracap). Vale para as imagens dos posts e as fotos de perfil novas, como o robô de antes.

No registro da moderação, uma imagem barrada pela OpenAI aparece com "conteúdo sexual, pela OpenAI: 97%"; pelo modelo
local, com "foto explícita: 92%", como antes.

## Como ligar

1. Criar uma conta em [platform.openai.com](https://platform.openai.com) e uma chave em **API keys** (a moderação não
   cobra).
2. No Vercel: **Settings → Environment Variables**, nome `OPENAI_API_KEY`, valor a chave, para Production. Depois,
   **Redeploy** (as variáveis novas só valem num deploy novo).
3. Para testar no computador: a mesma linha no arquivo `.env` da raiz do projeto (`OPENAI_API_KEY=...`, veja o
   `.env.exemplo`) e rodar `node ferramentas/testar-robo-de-imagens.mjs pasta/com/imagens`. A ferramenta mostra quem
   decidiu (OpenAI ou local) e a nota da OpenAI.

A chave nunca deve ser colada em conversas nem ir para o GitHub (o `.env` fica fora dele).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_robo_de_imagens.js` | `perguntarParaAOpenAI` e a decisão em `verificarImagem` (OpenAI, ou o modelo local de reserva) |
| `api/_moderacao.js` | `avaliarComOpenAI`, `lerModeracaoDaOpenAI` e os limites `LIMITE_DA_OPENAI` e `LIMITE_DE_DESENHO` |
| `api/_comunidade_rotas.js` | O registro guarda quem decidiu e a nota da OpenAI |
| `public/app.js` | O registro da moderação mostra a nota da OpenAI |
| `ferramentas/testar-robo-de-imagens.mjs` | Lê a chave do `.env` e mostra a decisão da OpenAI |
| `.env.exemplo` | A linha `OPENAI_API_KEY` |
| `test-api/moderacao.test.mjs` e `test-api/robo-openai.test.mjs` | A decisão com a OpenAI, a resposta dela e a reserva local (com respostas falsas no lugar da OpenAI) |

## Como foi testado

- A tabela acima, com 5 imagens explícitas (só as notas foram lidas), 225 capas da AniList (populares, ecchi, harém,
  ação, romance e slice of life) e 320 fotos comuns do Picsum.
- Os 99 testes da versão JavaScript passam: a OpenAI barrando uma foto sexual, deixando passar a foto que o modelo
  local achou 94% (a do vestido), deixando passar desenho, e o modelo local decidindo sem chave, com a OpenAI
  respondendo erro e sem rede.
- **Ainda não testado com a OpenAI de verdade:** precisa da chave. Assim que ela estiver no `.env`, dá para conferir
  as notas com as imagens de teste, as capas e as fotos comuns e ajustar `LIMITE_DA_OPENAI` se for preciso.
