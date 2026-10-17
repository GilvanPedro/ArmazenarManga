# 50 · Empacotar a extensão sem avisos

Ajuste feito em outubro de 2026 no envio da extensão à Mozilla (veja [Extensão no Firefox](45-extensao-no-firefox.md)).

## O problema

Ao enviar a extensão, a Mozilla mostrava dois avisos (não eram erros, o envio passava assim mesmo):

- `Unsupported "/background/service_worker" manifest property is ignored by Firefox`: o manifesto tinha o
  `service_worker` (que o Chrome usa) e o `scripts` (que o Firefox usa). O Firefox ignora o primeiro e avisa.
- `Manifest key not supported by the specified minimum Firefox for Android version`: a versão mínima (140) valia
  também para o Firefox para Android, mas lá a declaração de dados (`data_collection_permissions`) só existe a partir
  da 142.

## O que mudou

- **`extensao/manifest.json`:** ganhou `browser_specific_settings.gecko_android.strict_min_version: "142.0"`, foi
  para a versão **1.4.1** e voltou ao id `meus-mangas@gilvanpedro` (veja abaixo).
- **`ferramentas/empacotar-extensao.mjs`** (novo): monta os pacotes para as lojas, na raiz do projeto:
  - `extensao-firefox.zip`: o manifesto sem `background.service_worker`;
  - `extensao-chrome.zip`: o manifesto sem `background.scripts` e sem `browser_specific_settings` (só do Firefox),
    para a Chrome Web Store, o Edge e o Opera.

  Os outros arquivos vão como estão. O `manifest.json` da pasta continua com tudo, para carregar a extensão direto da
  pasta em qualquer navegador. A ferramenta não usa nenhum pacote, mas pede o Node 22 ou mais novo, e o mesmo
  conteúdo sempre gera o mesmo zip.

## O id da extensão

O id no Firefox (`browser_specific_settings.gecko.id`) é **`meus-mangas@gilvanpedro`** e não pode mudar: a extensão
foi enviada à Mozilla com ele antes da troca de nome, e a Mozilla recusa uma versão com outro id ("The add-on ID in
your manifest.json (viracap@gilvanpedro) does not match the ID of your add-on on AMO (meus-mangas@gilvanpedro)").
Ele tinha sido trocado para `viracap@gilvanpedro` junto com o nome e voltou ao original. O id não aparece para
ninguém: o nome na loja e no navegador vem do campo `name` ("Viracap - próximo capítulo").

## Como enviar uma versão nova

1. Subir o `"version"` no `extensao/manifest.json` (cada envio precisa de uma versão nova).
2. `node ferramentas/empacotar-extensao.mjs`.
3. Enviar o `extensao-firefox.zip` à Mozilla (e, se for publicar no Chrome, o `extensao-chrome.zip`).

Os dois zips são gerados a cada vez e não precisam ir para o repositório.

## Testes

O `addons-linter` mais recente da Mozilla (10.14.0), no `extensao-firefox.zip`, dá 0 erros, 0 avisos e 0 observações
(na pasta, com o manifesto completo, eram os dois avisos acima). Os dois zips abrem sem erro e têm o `manifest.json`
na raiz, com o `background` certo para cada navegador.

> Depois, a extensão passou para a versão **1.4.2** (botão "Lido" maior e mais alto): veja
> [Botão "Lido" maior e mais para cima](53-botao-lido-maior-e-mais-alto.md).
