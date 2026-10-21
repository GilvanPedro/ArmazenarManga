# 125 · Imagens de banner de até 4 MB, e a imagem nova aparecendo na hora

## Até 4 MB por imagem

Cada imagem de banner (a horizontal e a vertical) podia ter até **1 MB**. Agora pode ter até **4 MB**. As medidas
continuam as mesmas ([doc 97](97-banner-vertical-com-as-medidas-do-horizontal.md)).

O Vercel recusa um envio com mais de 4,5 MB. Por isso, quando as duas imagens escolhidas juntas passam de 4 MB, o
formulário as manda **uma por vez**: o primeiro envio cadastra ou salva o banner com a horizontal, e o segundo põe a
vertical nele. Enquanto isso, o botão mostra "Enviando a segunda imagem…". Se o segundo envio falhar, o banner já
existe e tentar de novo só edita ele, sem cadastrar outro.

O formulário avisa na hora quando a imagem passa de 4 MB ("Esta imagem tem 6,2 MB; o máximo é 4 MB") e não deixa
salvar. O servidor confere o mesmo limite.

Imagens grandes deixam as páginas mais lentas para quem lê. O ideal continua sendo até uns 300 KB (JPEG ou WebP).

## A imagem nova não aparecia depois de editar

Ao trocar a imagem de um banner, o site continuava mostrando a antiga por alguns minutos. A lista de banners no ar
ficava guardada por 2 minutos na página e mais 60 segundos no cache do navegador e da CDN.

Agora, depois de qualquer mudança num banner (cadastrar, editar, pausar ou apagar), a página esquece essa lista. A
próxima busca usa um endereço novo (`/api/banners/no-ar?agora=…`, sem cache), e a imagem nova já aparece. As imagens
em si nunca ficaram velhas: o endereço delas muda a cada troca (`?v=`).

Para quem está com o site aberto em outro aparelho, a troca aparece em até uns 3 minutos, como antes.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_banners.js` | O limite de 4 MB por imagem |
| `public/app.js` | O aviso de 4 MB, o envio em duas partes e a lista de banners buscada de novo depois de uma mudança |
