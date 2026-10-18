# 76 · Banners de anúncio: cadastro e relatórios

Um painel novo no **Gerenciar**, só para o dono do site, para cadastrar os **banners de anúncio** (horizontais e
verticais) e gerar os **relatórios para as empresas** donas deles. Feito em outubro de 2026, com o mesmo desenho do
painel de anúncios do CuidaMed (`GerenciamentoMedicamentos`, ADR-0054 a 0058), adaptado ao site.

**Ainda não existem os lugares do site onde os banners aparecem**: por enquanto é só o cadastro e os relatórios. A
tabela das contagens já existe, para os relatórios funcionarem assim que os lugares forem criados.

## Onde fica

`#/gerenciar/banners`, a aba **Banners** do Gerenciar (entre Finanças e Imagens da loja), só para o dono do site
(veja [Efeitos, Loja no topo e painel do dono](59-efeitos-loja-no-topo-e-dono.md)). Os outros admins não veem a aba, e
as rotas respondem 403 para eles.

## Cadastro

O botão **+ Banner** abre uma janela com:

- **Empresa** (1 a 120 caracteres): o nome que aparece nos relatórios. Dele sai o id do banner ("Padaria do Zé" vira
  `padaria-do-ze`, com número no fim se já existir);
- **Formato**: **horizontal** ou **vertical**;
- **Imagem**: PNG, JPEG ou WebP, até **1 MB**, com uma prévia e as medidas conferidas na hora;
- **Descrição** (até 200 caracteres): o texto para leitores de tela;
- **Link ao clicar**: vazio (o banner não é clicável), `https://...` ou `mailto:` (só destinatário, assunto e mensagem);
- **Peso** (1 a 100): a parte das exibições quando houver rodízio; peso 2 aparece o dobro de peso 1.

| Formato | Largura | Altura | Proporção | Exemplos |
|---------|---------|--------|-----------|----------|
| Horizontal | 300 a 4000 px | 50 a 2000 px | largura de 2 a 11 vezes a altura | 1280 × 400, 970 × 250, 728 × 90 |
| Vertical | 100 a 2000 px | 250 a 4000 px | altura de 1,5 a 5 vezes a largura | 300 × 600, 160 × 600 |

Ao escolher a imagem, o formato acompanha o jeito dela (deitada ou em pé). O **servidor confere tudo de novo** e não
confia no navegador: o tipo pelos primeiros bytes do arquivo (SVG e GIF são recusados), as medidas lidas só do
cabeçalho da imagem (uma imagem "bomba" não chega a ser aberta), o link, o peso e o máximo de **50 banners**.

Cada banner na lista mostra a prévia, o formato, se está **No ar** ou **Pausado**, as medidas, o peso, o link e os
números do mês, com os botões **Relatório**, **Editar**, **Pausar/Ativar** e **Apagar**. Pausar mantém o banner no
cadastro sem aparecer. Editar troca os dados e, se quiser, a imagem; trocar só o formato confere se a imagem atual
serve no formato novo.

## Relatórios

- **O geral do mês** (na própria aba): exibições, cliques, taxa de cliques e banners no ar; o gráfico de exibições por
  dia (a dica mostra os cliques); e a tabela por banner (formato, exibições, cliques, taxa e a parte de cada um nas
  exibições). Um banner apagado continua nos meses em que apareceu, marcado como "apagado". As setas trocam o mês.
- **A planilha do mês** (Baixar planilha do mês): um CSV com uma linha por dia, banner e lugar. As células são
  protegidas contra fórmulas de planilha, e o arquivo abre com os acentos certos no Excel.
- **O de cada banner** (Relatório): o banner, o mês, exibições, cliques, taxa de cliques, os gráficos de exibições e
  de cliques por dia e a tabela por lugar do site, com uma nota dizendo como os números são contados.

### O link para a empresa

No relatório de cada banner há o **link para a empresa** (`/#/relatorio-de-banner/{id}/{código}`), com os botões
Copiar, **Gerar link novo** e "Abrir como a empresa vê". Quem tem o link vê **só o relatório daquele banner, sem conta
e sem login**, numa página só com o relatório (sem o topo do site), com as setas dos meses e o botão **Imprimir ou
salvar em PDF** (a impressão sai em fundo branco, sem botões).

- O código é aleatório e próprio de cada banner (guardado com ele): o código de um banner não abre outro.
- **Gerar link novo** troca o código e desliga o link antigo (por exemplo, quando a empresa deixa de anunciar).
- Banner que não existe e código errado dão a mesma resposta ("Relatório não encontrado"), sem dar pistas, e a
  resposta vai sem cache e com `noindex`.

## As contagens

Na tabela `metricas_de_banner`: **por dia, banner e lugar do site** (`posicao`), somando exibições e cliques. Não se
guarda quem viu ou clicou (nem conta, nem endereço, nem aparelho), então os números não medem pessoas diferentes: isso
é dito nos relatórios. Quando os lugares do site forem criados, eles vão somar nessa tabela (e o critério de uma
exibição deve seguir o do CuidaMed: pelo menos metade do banner visível por pelo menos 1 segundo).

## API

Só o dono do site, menos as duas abertas indicadas.

| Método | Rota | O que faz |
|--------|------|-----------|
| `GET` | `/api/banners` | Os banners, com os números do mês, o máximo e as regras de cada formato |
| `POST` | `/api/banners` | Cadastra (formulário com a imagem) |
| `PUT` | `/api/banners/{id}` | Edita (a imagem é opcional) |
| `PUT` | `/api/banners/{id}/pausa` | `{ pausado }` |
| `POST` | `/api/banners/{id}/novo-link` | Troca o código do link da empresa |
| `DELETE` | `/api/banners/{id}` | Apaga (as contagens ficam) |
| `GET` | `/api/banners/relatorio?mes=AAAA-MM` | O relatório geral do mês |
| `GET` | `/api/banners/planilha?mes=AAAA-MM` | A planilha (CSV) do mês |
| `GET` | `/api/banners/{id}/relatorio?mes=` | O relatório de um banner, com o link da empresa |
| `GET` | `/api/banners/{id}/imagem?v=` | **Aberta.** A imagem do banner (guardada por um ano com `?v=`) |
| `GET` | `/api/banners/relatorio-da-empresa/{id}/{código}?mes=` | **Aberta.** O relatório da empresa, pelo código |

## O que é guardado

| Tabela | O que tem |
|--------|-----------|
| `banners` | id, empresa, descrição, link, formato, peso, pausado, a imagem (bytes, tipo e medidas), o código do link da empresa e as datas |
| `metricas_de_banner` | dia, banner, lugar, exibições e cliques (sem ligação com o cadastro: um banner apagado continua nos números) |

## Diferenças do CuidaMed

- Formatos **horizontal e vertical** (lá só horizontal), com as medidas de cada um.
- O painel fica **dentro do site**, no Gerenciar do dono (lá é uma página com senha própria).
- O link da empresa usa um **código aleatório por banner**, que dá para trocar sozinho (lá é um HMAC com a senha do
  painel, que só muda trocando a senha e derrubando todos os links).
- Imagens WebP também são aceitas. Vídeo nos banners e o rodízio por peso ficaram para quando houver os lugares do site.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | Novo: tabelas, regras do cadastro, relatórios, planilha e as rotas |
| `api/index.js` | As rotas dos banners (as abertas antes do login) e as tabelas novas |
| `public/app.js` | A aba Banners, a janela de cadastro, os relatórios e a página do relatório da empresa |
| `public/app.css` | O estilo da aba, dos relatórios e da impressão |
| `test-api/banners.test.mjs` | Novo: id, link, campos, tipo da imagem, medidas, relatório e planilha |

## Como foi testado

- Os 95 testes da versão JavaScript passam (7 novos).
- No navegador, num banco local: cadastrar um banner horizontal (1280 × 400) e um vertical (300 × 600); uma imagem
  quadrada foi recusada com as medidas recomendadas, e um link `javascript:` foi recusado pelo servidor. Com números
  de exemplo inseridos no banco, o relatório geral mostrou os totais, o gráfico e a tabela (com um banner apagado), a
  planilha saiu em CSV, pausar funcionou, e o link da empresa abriu sem login só com o relatório daquele banner. Um
  código errado, o código de outro banner e o link antigo depois de "Gerar link novo" deram 404; uma conta que não é
  a dona recebeu 403. O site compactado também foi conferido.

> Depois, o tamanho recomendado do vertical passou a ser 400 × 1280: veja [Banner vertical recomendado: 400 × 1280](80-banner-vertical-400x1280.md).

> Depois, os banners passaram a ter o valor que rendem (que entra nas Finanças) e a data em que acabam, e as Finanças, a
> pizza de receita e despesa: veja [A receita dos banners e a pizza das Finanças](81-receita-dos-banners-e-pizza-das-financas.md).

> Depois, os banners passaram a aparecer no site: veja [Os lugares de banner no site](91-lugares-de-banner.md).

> Depois, um banner passou a poder ter as duas imagens (horizontal e vertical): veja [Banner com imagem horizontal e vertical](96-banner-com-imagem-horizontal-e-vertical.md).
