# 48 · Moderação da Comunidade e robô de imagens

Mudança feita em outubro de 2026 na Comunidade (veja [Comunidade](28-comunidade.md)): os admins podem suspender e
banir contas e têm uma aba de gerenciamento, e um robô confere as imagens antes de irem ao ar. Só existe na versão do
Vercel, como o resto da Comunidade.

## Quem é admin

As contas marcadas como admin no banco e as dos e-mails da variável **`MANGATRACKER_ADMIN_EMAIL`** no Vercel (veja
[Mangás antigos só para admins](26-mangas-antigos-so-para-admins.md)). Admins não podem ser suspensos nem banidos, e
ninguém pune a si mesmo.

## Suspender e banir

- **Suspensão:** por 1 hora, 6 horas, 1 dia, 3 dias, 7 dias, 30 dias, 90 dias ou 1 ano. Vence sozinha.
- **Banimento:** vale até um admin tirar.
- Os dois aceitam um **motivo** opcional (até 300 caracteres), que a pessoa vê.
- Quem está suspenso ou banido **não publica, não comenta e não envia imagens**. Continua podendo ler, curtir e
  seguir. Na Comunidade e no próprio perfil, o campo de escrever vira um aviso com o motivo e, na suspensão, até
  quando ela vale. Se tentar mesmo assim (pela janela de escrever, por exemplo), o servidor recusa com a mesma
  explicação.
- Uma conta suspensa pode ser banida direto; tirar a punição devolve tudo.
- Apagar posts e comentários dos outros os admins já podiam. Agora isso também fica no registro.

## A aba Gerenciar

Aparece no topo, ao lado de Biblioteca e Comunidade, só para admins (`#/gerenciar`):

- **Contas:** busca por nick ou e-mail e filtros Todas, Punidas, Suspensas e Banidas. As punidas vêm primeiro. Cada
  conta mostra e-mail, posts, imagens barradas pelo robô, a punição (com motivo, quem puniu e quando) e os botões
  Suspender, Banir, Tirar suspensão ou Desbanir.
- **Registro** (`#/gerenciar/registro`): tudo o que foi feito, do mais novo para o mais antigo. Inclui suspensões,
  banimentos, punições tiradas, posts e comentários apagados por admins (com o começo do texto) e imagens barradas
  pelo robô.

No perfil de qualquer pessoa, os admins também veem uma caixa **Moderação**, com a situação da conta e os mesmos
botões.

## O robô de imagens

Toda imagem enviada para um post e toda foto de perfil nova passam por um classificador aberto, o **NSFWJS** (modelo
MobileNetV2Mid), rodando na própria função do Vercel, sem serviço externo nem custo. O `sharp` transforma a imagem em
pixels, e o TensorFlow.js (em WebAssembly, ~85 ms por imagem) dá a nota de cada classe: Drawing (desenho), Hentai
(desenho explícito), Neutral, Porn (foto explícita) e Sexy (foto insinuante).

**O que é barrado:** só **foto explícita de pessoa de verdade**, ou seja, a nota "Porn" de 70% ou mais e maior que as
de desenho ("Drawing" + "Hentai") somadas. Por decisão do dono do site:

- **capas de mangá nunca contam como conteúdo sexual.** As capas das listas anexadas nem passam pelo robô, e nas
  imagens dos posts o desenho sempre pesa a favor;
- **arte e desenho passam**, inclusive os explícitos ("Hentai");
- foto só insinuante ("Sexy") passa.

**Quando barra:** a imagem não é guardada, a pessoa vê o aviso ("Essa imagem parece ser uma foto com conteúdo sexual
explícito…") e o registro ganha uma linha com quem tentou, onde (post ou foto de perfil) e a nota. O admin decide se
pune; não há punição automática. Se o robô não conseguir conferir (falha ao carregar o modelo, por exemplo), a imagem
também não entra, e a pessoa é convidada a tentar de novo.

**Limites conhecidos:**

- No teste com 20 capas reais (entre elas obras ecchi e duas marcadas como adultas pela AniList), todas passaram com
  0% de "foto explícita". Não foi testado com imagens explícitas de verdade, então a taxa de acerto nesse caso vem do
  modelo, não de um teste nosso.
- De GIF e WEBP animados, só o primeiro quadro é conferido.
- As imagens publicadas antes do robô não foram conferidas.
- A primeira imagem depois de a função "acordar" leva ~0,3 s a mais, para carregar o modelo.

## Banco de dados

Na tabela `contas`: `punicao` ('suspensa' ou 'banida'), `punida_ate`, `punicao_motivo`, `punida_por` e `punida_em`.
Tabela nova `moderacao` (o registro): conta, admin, ação, motivo, detalhes (JSON) e data. As duas são criadas sozinhas
na primeira chamada, junto com o resto da Comunidade.

## API

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/comunidade/situacao` | A punição de quem está usando (`null` se livre) |
| `GET` | `/api/comunidade/gerenciamento/contas?busca=&filtro=&pagina=` | Contas para o gerenciamento (30 por página). Só admins |
| `POST` | `/api/comunidade/gerenciamento/contas/{id}/suspensao` | Suspende: `{ horas, motivo }`. Só admins |
| `POST` | `/api/comunidade/gerenciamento/contas/{id}/banimento` | Bane: `{ motivo }`. Só admins |
| `DELETE` | `/api/comunidade/gerenciamento/contas/{id}/punicao` | Tira a suspensão ou o banimento. Só admins |
| `GET` | `/api/comunidade/gerenciamento/registro?pagina=&conta=` | O registro da moderação. Só admins |

`GET /api/comunidade/contas/{id}` (perfil) passa a trazer `moderacao` (`punicao` e `podePunir`) quando quem pede é
admin.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_moderacao.js` | Novo: tabelas, regras de suspensão e motivo, punição que vale agora, mensagens, registro e quando barrar uma imagem |
| `api/_robo_de_imagens.js` | Novo: carrega o NSFWJS e classifica a imagem |
| `api/_comunidade_rotas.js` | Bloqueio de quem está punido, robô no envio de imagens, registro de posts e comentários apagados por admins, rotas do gerenciamento e da situação, moderação no perfil |
| `api/index.js` | Foto de perfil nova passa pelo robô (e é apagada se barrada) |
| `package.json` | `nsfwjs`, `@tensorflow/tfjs` e `@tensorflow/tfjs-backend-wasm` (4.22.0, mesma versão) e `sharp` |
| `vercel.json` | Inclui os arquivos `.wasm` do TensorFlow na função (o caminho só é montado com o programa rodando) |
| `public/index.html` | Link "Gerenciar" no topo, escondido para quem não é admin |
| `public/app.js` | Tela de gerenciamento (contas e registro), janelas de suspender e banir, caixa de moderação no perfil e aviso para quem está punido |
| `public/app.css` | Estilos da moderação |
| `test-api/moderacao.test.mjs` | Novo: regras de suspensão, punição que vale, mensagens, quando barrar e o robô lendo PNG, JPG, WEBP e GIF |

A função do Vercel fica com ~35 MB (o limite é 250 MB). Só o modelo usado entra; os outros dois do pacote ficam de
fora.

## Testes

- `npm test`: 66 testes passando (5 novos), incluindo o robô classificando imagens geradas.
- No navegador, com uma conta admin e uma comum: buscar por e-mail e por nick; suspender por 3 dias com motivo (o
  leitor vê o aviso, publicar, comentar e enviar imagem dão 403 com a explicação, curtir continua); filtro Suspensas;
  banir a partir da suspensão; filtro Banidas; desbanir (o leitor volta a publicar); suspensão vencida não vale; caixa
  de moderação no perfil; admin apagando post do leitor; quem não é admin recebe 403 na API e "Só para
  administradores" em `#/gerenciar`; banir outro admin, punir a si mesmo e suspender por 0 horas são recusados; capa
  de mangá passa no post e como foto de perfil; o registro mostra tudo, na ordem. Sem rolagem para o lado no celular.
