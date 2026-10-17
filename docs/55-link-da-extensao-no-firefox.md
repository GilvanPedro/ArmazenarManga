# 55 · Link da extensão na loja do Firefox

Ajuste na aba **Extensão e atalho** da Biblioteca (veja [Extensão e atalho](08-extensao-e-atalho.md)), feito em
outubro de 2026.

## O que mudou

**Antes:** a aba explicava como carregar a extensão a partir dos arquivos do projeto: no Chrome, ligar o modo do
desenvolvedor e escolher a pasta `extensao`; no Firefox, abrir `about:debugging` e escolher o `manifest.json`. Isso
só servia para quem tinha o código, e no Firefox a extensão sumia ao fechar o navegador.

**Agora:** essas instruções saíram. No lugar há o botão **Instalar no Firefox**, que abre a página da extensão na
loja da Mozilla (em outra aba), e dois passos: adicionar ao Firefox e liberar o site pelo ícone da extensão. Um aviso
diz que, por enquanto, a extensão está só na loja do Firefox (inclusive o Firefox para Android).

- O endereço é `https://addons.mozilla.org/firefox/addon/viracap-marcar-mangas/`, sem a língua: a Mozilla abre a
  página na língua de quem visita (o endereço com `en-US` abriria sempre em inglês). Fica na constante
  `EXTENSAO_NO_FIREFOX` do `app.js`.
- O texto sobre o botão "✓ Lido" passou a dizer que ele aparece na **borda direita** das páginas (veja
  [Botão "Lido" maior e mais para cima](53-botao-lido-maior-e-mais-alto.md)).
- O resto da aba (a situação da extensão, os três jeitos de marcar como lido e o favorito) não mudou.

Enquanto a Mozilla não aprova a extensão, a página da loja só abre para o dono da conta de desenvolvedor; para os
outros, o link funciona depois da aprovação. Para testar a extensão a partir dos arquivos, as instruções continuam
em [Extensão e atalho](08-extensao-e-atalho.md) e em [Empacotar a extensão](50-empacotar-a-extensao.md).

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Botão "Instalar no Firefox" no lugar das instruções por arquivo; texto do botão "Lido" |

## Como foi testado

No navegador, com login, na aba Extensão e atalho: o botão aparece embaixo da situação da extensão e leva ao
endereço da loja; as instruções antigas sumiram.
