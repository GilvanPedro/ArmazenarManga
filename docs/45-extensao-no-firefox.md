# 45 · Extensão no Firefox

Ajuste feito em outubro de 2026 para publicar a extensão (pasta `extensao/`) no site de complementos da Mozilla,
addons.mozilla.org (veja [Extensão e atalho](08-extensao-e-atalho.md)).

## O problema

Ao enviar a extensão, a Mozilla recusava com: `The "data_collection_permissions" property is missing`. Desde o fim
de 2025, toda extensão nova precisa declarar no manifesto quais dados ela envia para fora do navegador, ou declarar
que não envia nenhum.

## O que a extensão envia

Ela não manda nada sozinha. Quando a pessoa marca um capítulo como lido (botão "Lido", atalho Alt+Shift+L ou o botão
no ícone), a extensão abre o site Viracap com o **endereço do capítulo**, o **título da página**, o **título
"og:title"**, a **capa** e o **link do próximo capítulo**. Quando o site pede o próximo capítulo, ela conta ao site
qual é o endereço dele. Pelas categorias da Mozilla, isso é:

- `browsingActivity` (atividade de navegação): endereços das páginas visitadas;
- `websiteContent` (conteúdo do site): títulos, imagem e links das páginas.

Os dois são **obrigatórios** (`required`), porque sem eles a extensão não faz o que promete. Ao instalar, o Firefox
mostra que a extensão usa esses dados.

## O que mudou

- `extensao/manifest.json`, em `browser_specific_settings.gecko`:
  - `data_collection_permissions` com `"required": ["browsingActivity", "websiteContent"]`;
  - `strict_min_version` de 121 para **140**, a primeira versão do Firefox que entende essa declaração;
- versão da extensão de 1.3.0 para **1.3.1** (a Mozilla exige uma versão nova a cada envio).

O mesmo manifesto continua servindo para Chrome, Edge, Brave e Opera GX, que ignoram a parte do Firefox.

## Como enviar

1. Montar o zip com o `manifest.json` **na raiz**, não dentro de uma pasta `extensao/`. Por exemplo, de dentro da
   pasta: `cd extensao && zip -r ../extensao-firefox.zip .`.
2. Em https://addons.mozilla.org/developers/, **Enviar um novo complemento**. Escolher **"Em seu próprio site"** para
   só assinar (instalar pelo arquivo `.xpi` que a Mozilla devolve) ou **"Neste site"** para aparecer na loja.
3. Se a Mozilla pedir o código-fonte: não precisa, porque os arquivos não são gerados nem minificados.
4. Depois de aprovada (na assinatura para o próprio site, costuma ser automática e rápida), baixar o `.xpi` e abrir no
   Firefox para instalar.

## Testes

`web-ext lint` (a ferramenta da Mozilla) na pasta `extensao/`: 0 erros e 1 aviso. O aviso é que o Firefox não usa
`background.service_worker`, que fica no manifesto para o Chrome. O Firefox usa o `background.scripts` que está ao
lado.

> Depois, com a [troca de nome para Viracap](46-nome-viracap.md), a extensão passou para a versão 1.4.0 e o id
> `viracap@gilvanpedro`.

> Depois, os zips passaram a ser montados por `ferramentas/empacotar-extensao.mjs`, sem os avisos da Mozilla: veja
> [Empacotar a extensão](50-empacotar-a-extensao.md).
