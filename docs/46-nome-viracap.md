# 46 · Novo nome: Viracap

Mudança feita em outubro de 2026: o site e a extensão deixaram de se chamar **Meus Mangás** e passaram a se chamar
**Viracap**.

## Por que esse nome

"Viracap" junta **virar** e **cap** (de capítulo): passar para o próximo capítulo, que é o que o site faz de mais
marcante (guarda onde você parou e abre o próximo). É uma palavra só, em português, que não existia como marca, e
não deixa manhwas e manhuas de fora como "mangá" deixaria. Entre as opções pensadas estavam Folhetim, Marcapítulo,
Capiteca, Mangário e Vira-Página.

## O que mudou

- **Site:** o nome no topo, na tela de entrar e no título de todas as abas (`Comunidade · Viracap`,
  `Descobrir · Viracap`…). Mudaram também o título e as marcações de compartilhamento do `index.html` e a imagem
  `compartilhar.png`, agora com "Viracap" e a frase "Sua lista de mangás, manhwas e manhuas: continue de onde parou,
  capítulo a capítulo."
- **Extensão:**
  - nome "Viracap - próximo capítulo", com o nome novo no botão da barra, na janelinha do ícone, nos avisos e na
    descrição;
  - versão **1.4.0**;
  - id no Firefox **`viracap@gilvanpedro`** (era `meus-mangas@gilvanpedro`). Na Mozilla, o id não pode mudar depois da
    primeira publicação, e a extensão ainda não tinha sido publicada lá;
  - `extensao-firefox.zip` refeito.
- **Avisos e identificação:** o alerta do favorito ("Viracap: nao consegui ler esta pagina…"), a mensagem da versão
  Java ao iniciar e a identificação enviada às fontes de sinopse e recomendações (`Viracap/1.0`).
- **Projeto:** nome do pacote (`viracap`) no `package.json`, título do `README.md` e da documentação.

## O que continua com o nome antigo (de propósito)

São nomes internos, que ninguém vê e que, se mudassem, quebrariam coisas que já funcionam:

- a marca `<meta name="meus-mangas-site">`, pela qual a extensão reconhece o site, e as mensagens trocadas entre os
  dois (`meus-mangas-site` e `meus-mangas-extensao`). Assim, extensões já instaladas continuam funcionando;
- as preferências guardadas no navegador (`meus-mangas-ordem` e outras), para ninguém perder filtros e ordem;
- o nome do serviço no `render.yaml`, que trocado criaria um serviço novo no Render;
- o endereço do site (`registrar-manga.vercel.app`) e o nome do repositório.

## Endereço

O endereço `viracap.vercel.app` estava livre quando o nome foi escolhido. Para usá-lo: no Vercel, em
*Settings > Domains*, adicionar `viracap.vercel.app`. Depois, trocar o endereço no `index.html` (canônico e Open
Graph), no `robots.txt` e no `sitemap.xml`, e cadastrar o endereço novo no Google Search Console (veja
[Site no Google](44-site-no-google.md)).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/index.html` | Título, `og:site_name`, `og:title`, texto da imagem e nome no topo |
| `public/app.js` | Títulos das abas, nome na tela de entrar e alerta do favorito |
| `public/compartilhar.png` | Imagem de prévia com o nome novo |
| `extensao/manifest.json` | Nome, descrição, título do botão, versão 1.4.0 e id `viracap@gilvanpedro` |
| `extensao/popup.html`, `popup.js`, `conteudo.js`, `fundo.js` | Nome nos textos e comentários |
| `api/_sinopse.js`, `ClienteHttpPadrao.java` | Identificação `Viracap/1.0` |
| `App.java`, `iniciar.sh` | Nome na mensagem de início |
| `package.json`, `package-lock.json` | Nome do pacote |

## Testes

`npm test` (61) e os testes da versão Java passando. `web-ext lint` na extensão: 0 erros (o mesmo aviso de antes, do
`service_worker` que fica para o Chrome). Nenhum texto "Meus Mangás" sobrou fora da documentação e dos nomes
internos listados acima.
