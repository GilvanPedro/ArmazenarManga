# 131 · Banners mais leves

Os banners de anúncio passaram a pesar bem menos para quem abre o site, e a carregar sem atrasar o resto da página.

## As imagens são diminuídas e passam para WebP

Cada imagem chegava ao leitor do jeito que foi enviada, que podia ter até 4 MB ([doc 125](125-banners-maiores-e-imagem-nova-na-hora.md)).
Agora, ao salvar, o servidor:

- **diminui a imagem** para o maior tamanho em que ela aparece no site, em dobro para telas de alta resolução:
  o horizontal ocupa até 970 × 200 px, então fica com no máximo **1940 × 400**; o vertical ocupa até 200 px de largura,
  então fica com no máximo **400 × 2000**. A proporção não muda, e imagem menor que isso não é aumentada;
- **passa para WebP**, com qualidade 85 (texto continua nítido). Banner animado continua animado;
- **fica com a original** se a otimizada não sair menor.

Exemplo dos testes: uma imagem de 3,2 MB (2000 × 600, PNG) virou 310 KB.

As medidas mostradas nos relatórios e no gerenciamento continuam sendo as da imagem enviada.

## As que já estavam no ar

As imagens enviadas antes desta mudança são otimizadas sozinhas, **na primeira vez que alguém as pede**. A versão
otimizada fica guardada no banco (coluna `otimizada` em `imagens_de_banner`) e o endereço dela não muda.

## Menos idas ao banco

- **As imagens** (o endereço leva `?v=`, que muda a cada troca) agora ficam guardadas também na **CDN da Vercel**, por
  um ano (`s-maxage`). Antes só o navegador de cada leitor guardava, e todo leitor novo fazia a imagem sair do banco.
- **A lista dos banners no ar** fica um minuto na CDN e, depois desse minuto, a CDN ainda entrega a guardada enquanto
  busca a nova (`stale-while-revalidate`), então ninguém espera por ela. Depois de você mexer num banner, o site busca
  a lista por um endereço novo, sem cache ([doc 125](125-banners-maiores-e-imagem-nova-na-hora.md)).

## No navegador

As imagens dos banners carregam com `loading="lazy"` e prioridade baixa: o banner do fim da lista só é baixado quando
a pessoa rola perto dele, e as capas dos mangás vêm primeiro.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | `otimizarImagemDoBanner`, a coluna `otimizada`, a otimização das antigas e o cache na CDN |
| `public/app.js` | As imagens dos banners com `loading="lazy"` e prioridade baixa |
| `test-api/banners.test.mjs` | O teste da otimização |
