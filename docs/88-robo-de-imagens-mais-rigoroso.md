# 88 · Robô de imagens mais rigoroso

O dono do site testou o robô de imagens da Comunidade ([doc 48](48-moderacao-da-comunidade.md)) com 5 imagens
explícitas que deveriam ser barradas, e **só 1 das 5 foi barrada**. O robô passou a usar outro modelo, a encaixar a
imagem sem esticar e um limite um pouco mais baixo: agora as 5 são barradas, e nenhuma capa de mangá nem foto comum
dos testes é barrada.

## O teste

As imagens ficaram só no computador do dono e foram passadas pelo robô sem ser abertas (só as notas foram lidas).
Para conferir se o robô não começaria a barrar o que não deve, entraram também:

- **71 capas de mangá** da AniList: as mais populares, as mais populares de ecchi e de romance;
- **60 fotos comuns** do Picsum (paisagens, objetos, pessoas, lugares).

| Robô | Imagens explícitas barradas | Capas barradas | Fotos comuns barradas |
|------|-----------------------------|----------------|-----------------------|
| Antes: MobileNetV2Mid, imagem esticada, limite 70% | **1 de 5** | 0 de 71 | 1 de 60 (uma xícara de café, 94%) |
| MobileNetV2, imagem esticada, limite 70% | 4 de 5 | 0 de 71 | 2 de 60 (a xícara e uma sala com cadeiras) |
| **Agora: MobileNetV2, imagem encaixada, limite 60%** | **5 de 5** | **0 de 71** (a maior nota foi 7,7%) | **0 de 60** (a maior nota foi 53%) |
| InceptionV3 (o maior do pacote) | 5 de 5 | – | – |

O InceptionV3 também acertou as 5, mas leva ~35 s para carregar e ~0,6 s por imagem: lento demais para uma função do
Vercel. O MobileNetV2 é menor que o Mid (3,5 MB contra 5,7 MB) e tão rápido quanto (~90 ms por imagem).

## O que mudou

- **Modelo:** de MobileNetV2Mid para **MobileNetV2** (os dois vêm dentro do pacote `nsfwjs`, sem serviço externo).
- **Encaixe:** a imagem entra inteira no quadrado de 224 × 224 com faixas pretas (`fit: contain`), em vez de ser
  esticada. Esticar deformava a imagem e o modelo errava mais (nas fotos comuns, inclusive).
- **Limite:** a nota de "foto explícita" (Porn) para barrar caiu de **70% para 60%**. A imagem explícita com a nota mais
  baixa ficou em 64%; a foto comum com a nota mais alta, em 53%.
- Continua valendo: a nota de foto explícita precisa ser maior que a de desenho + desenho explícito somadas, a imagem
  barrada não é guardada, a pessoa vê o aviso, o registro da moderação ganha uma linha e não há punição automática.

**Cuidado:** a margem entre 53% (a foto comum mais alta) e 60% é pequena e o teste teve 60 fotos. Se aparecer foto
comum barrada por engano, o limite fica em `LIMITE_DE_FOTO_EXPLICITA`, em `api/_moderacao.js`.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_robo_de_imagens.js` | O modelo MobileNetV2 e a imagem encaixada |
| `api/_moderacao.js` | O limite em 60% |
| `test-api/moderacao.test.mjs` | O limite novo, com as notas do teste |

## Como foi testado

- A tabela acima, com os três modelos do pacote e os três jeitos de levar a imagem ao quadrado.
- `node ferramentas/testar-robo-de-imagens.mjs` com as 5 imagens: 5 barradas.
- No site local, enviando para um post: as duas imagens explícitas enviadas receberam o aviso e entraram no registro
  da moderação (notas 92% e 64%); três capas ecchi e a xícara de café foram aceitas. A primeira imagem levou ~0,7 s
  (carregando o modelo) e as outras ~0,12 s.
- Os 96 testes da versão JavaScript passam.
