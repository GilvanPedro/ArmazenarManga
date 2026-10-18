# 84 · Quatro molduras de imagem na loja

Quatro bordas novas (R$ 4,50 cada) feitas de imagens enviadas pela aba **Imagens da loja** do Gerenciar, no mesmo
esquema da [Celestial](62-borda-celestial-de-imagem.md):

| Borda (id) | Imagem no banco | Como é | A luz do canto |
|------------|-----------------|---------|----------------|
| Arte Derretida (`derretida`) | `arte-derretendo.png` | Ouro e cristal azul que derrete em gotas, com runas | A estrela brilha |
| Relíquia (`reliquia`) | `moldura-antiga.png` | Bronze antigo e gasto, com runas gravadas | O sol e a lua brilham |
| Bosque Élfico (`elfica`) | `moldura-madeira.png` | Madeira com vinhas, flores e runas verdes | A esmeralda brilha |
| Portão do Inferno (`inferno`) | `portao-inferno.png` | Pedra escura com lava, correntes e um demônio | Os olhos acendem como brasa |

Cada uma tem um brilho em volta, na cor dela, que respira devagar (no Portão do Inferno ele tremula como brasa, no
mesmo ritmo dos olhos).

## Como a imagem fica em cima da capa

As quatro são PNGs de 378 × 540 com o meio transparente e saem do mesmo molde: a faixa da moldura vai de x 14 a 47 e
de 332 a 365, e de y 19 a 52 e de 492 a 525 (medido pela transparência dos pixels). O meio da faixa fica em cima da
beira da capa, então a capa ocupa, na imagem, de x 30,5 a 348,5 e de y 35,5 a 508,5 (318 × 473, quase 2:3). Em
porcentagem da capa, a imagem começa em −9,59% e −7,51% e mede 118,87% × 114,16%. Uma moldura nova no mesmo molde só
precisa da imagem, do item em `api/_loja.js` e das variáveis dela no `app.css` (`--imagem-da-moldura`, as cores do
brilho e a posição da luz do canto).

## O brilho sem esbranquiçar a capa

Um `drop-shadow` direto na moldura brilharia também pela beira de dentro, por cima da imagem do mangá, e a deixaria
esbranquiçada. Por isso o brilho fica numa cópia da moldura (`::before`) com uma máscara que tira o retângulo da capa,
e com 20 px de folga em volta para o brilho de fora não ser cortado num retângulo. A moldura de verdade fica nítida
por cima.

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `api/_loja.js` | Os quatro itens |
| `public/app.css` | As quatro molduras (o molde comum, o brilho com máscara e as cores e a luz de cada uma) |

## Como foi testado

- As quatro imagens foram conferidas no ar (`/api/loja/imagens/{nome}`), baixadas e medidas.
- Os 96 testes da versão JavaScript passam (inclusive o de ids que não se repetem).
- No navegador, num banco local com as mesmas imagens: as quatro numa capa de verdade da biblioteca (tema escuro, e a
  Arte Derretida também no claro) e na loja, com a imagem do mangá limpa, o brilho por fora sem cortes e a luz em cima
  da estrela, do sol, da esmeralda e dos olhos. O site compactado também foi conferido.

> Depois, as molduras de imagem passaram a encolher a capa para 84%, para não encostar nas vizinhas: veja [Capas altas esticando e molduras encostando](85-capas-altas-e-molduras-vizinhas.md).
