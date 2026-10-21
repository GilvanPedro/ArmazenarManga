# 129 · A página atual na cor do tema

Na paginação da Biblioteca (e de Lançam hoje, que usa a mesma), o número da página atual era preto no tema claro e
branco no escuro, parecido com os outros botões. Agora ele fica na **cor de destaque do tema** do usuário, com o texto
em negrito e um brilho em volta, para achar de relance em que página se está.

- Cada tema usa a própria cor: laranja no padrão, vermelho no Palácio, rosa no Kyoto e no Pétalas, verde na Aurora,
  dourado no Estrelas, branco na Lâmina, e assim por diante. A cor do número é a "sobre o destaque" do tema, a mesma dos
  botões principais.
- Os temas com botões próprios (Palácio, Kyoto e Lâmina) passavam por cima dessa cor. A regra da página atual repete
  os mesmos `:not(.primario):not(.perigo):not(.seguir)` deles para ganhar.
- O contraste entre o número e o fundo foi medido nos 19 temas, claros e escuros: vai de 3,4 (Pétalas) a 15,9 (Lâmina),
  acima do mínimo de 3 para texto grande e em negrito.
- Passar o mouse na página atual não muda nada, porque ela já está aberta.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `public/app.css` | `.paginacao .botao[aria-current=page]` na cor de destaque do tema |
