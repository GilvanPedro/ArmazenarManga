# 77 · Sem a aba Imagens da loja

Feito em outubro de 2026, a pedido do dono do site: a aba **Imagens da loja** saiu do Gerenciar (veja
[Imagens da loja no banco](63-imagens-da-loja-no-banco.md)). Ela servia para enviar imagens de bordas e temas feitos
a partir de imagens; o tema de imagem já tinha saído (veja [Sem tema de imagem de fundo](72-sem-tema-de-imagem.md)) e
nenhum item novo assim está previsto.

- Saíram a aba, a tela de envio e as rotas que **listavam, enviavam e apagavam** imagens (`GET /api/loja/imagens`,
  `PUT` e `DELETE /api/loja/imagens/{nome}`, que agora dão 404), junto com a conferência do formato das imagens
  enviadas e o teste dela.
- **Continua** a rota que **serve** as imagens já guardadas, `GET /api/loja/imagens/{nome}`, e a tabela
  `imagens_da_loja`: a borda **Celestial** pega a moldura dela ali. Sem essa rota, a Celestial ficaria sem a moldura.
- Para trocar ou acrescentar uma imagem no futuro, seria preciso pôr a aba de volta (o código está no histórico do
  Git) ou gravar direto no banco.
- O endereço antigo `#/gerenciar/imagens` abre o Painel.
- As abas do Gerenciar do dono ficaram: Painel, Finanças, Banners, Contas e Registro.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.js` | Sem a aba e a tela de Imagens da loja |
| `public/app.css` | Sem o estilo da tela |
| `api/_loja.js` | Sem as rotas de listar, enviar e apagar, e sem a conferência das imagens enviadas |
| `test-api/loja.test.mjs` | Sem o teste da conferência |

## Como foi testado

Num banco local, com a imagem da Celestial guardada: `/api/loja/imagens/celestial.webp` continuou respondendo com a
imagem; listar e enviar deram 404; o Gerenciar mostrou Painel, Finanças, Banners, Contas e Registro, e
`#/gerenciar/imagens` abriu o Painel, sem erros. Os 94 testes da versão JavaScript passam.
