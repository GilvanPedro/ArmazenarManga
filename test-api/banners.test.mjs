// Testes dos banners de anuncio: o cadastro (empresa, link, imagens horizontal e vertical) e os relatorios.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { celulaDoCsv, diasDoMes, idDaEmpresa, lerMesDoRelatorio, montarRelatorio, problemaNasMedidas, taxaDeCliques, tipoDaImagemDoBanner,
    validarDadosDoBanner, validarLinkDeBanner } from '../api/_banners.js';

test('o id vem do nome da empresa, sem acento, e ganha numero se ja existir', () => {
    assert.equal(idDaEmpresa('Padaria do Zé!'), 'padaria-do-ze');
    assert.equal(idDaEmpresa('Padaria do Zé', ['padaria-do-ze']), 'padaria-do-ze-2');
    assert.equal(idDaEmpresa('Padaria do Zé', ['padaria-do-ze', 'padaria-do-ze-2']), 'padaria-do-ze-3');
    assert.equal(idDaEmpresa('!!!'), 'banner');
    assert.ok(idDaEmpresa('x'.repeat(200)).length <= 40);
});

test('o link: vazio, https ou mailto simples; nada de http, javascript ou copia oculta', () => {
    assert.equal(validarLinkDeBanner(''), null);
    assert.equal(validarLinkDeBanner('  '), null);
    assert.equal(validarLinkDeBanner('https://loja.exemplo.com/promo?x=1'), 'https://loja.exemplo.com/promo?x=1');
    assert.equal(validarLinkDeBanner('mailto:contato@exemplo.com?subject=Anuncie'), 'mailto:contato@exemplo.com?subject=Anuncie');
    for (const ruim of ['http://loja.com', 'javascript:alert(1)', 'https://localhost', 'mailto:a@b.com?bcc=c@d.com', 'mailto:nada', 'ftp://x.com', 'loja.com']) {
        assert.throws(() => validarLinkDeBanner(ruim), /Link inválido|só pode ter/, ruim);
    }
});

test('os campos do formulario sao conferidos', () => {
    assert.deepEqual(validarDadosDoBanner({ empresa: '  Loja   do Otaku ', texto: 'Mangás em promoção', link: '', formato: 'vertical', peso: '3' }),
        { empresa: 'Loja do Otaku', texto: 'Mangás em promoção', link: null, peso: 3, valor: null, cobranca: null, terminaEm: null },
        'o formato saiu dos campos: as imagens (horizontal e vertical) sao conferidas a parte (doc 96)');
    assert.equal(validarDadosDoBanner({ empresa: 'X', formato: 'horizontal' }).peso, 1, 'peso padrao');
    assert.equal(validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', peso: 0 }).peso, 0, 'peso 0: nao aparece');
    assert.throws(() => validarDadosDoBanner({ empresa: '', formato: 'horizontal' }), /nome da empresa/);
    assert.throws(() => validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', peso: 101 }), /de 0 a 100/);
    // o valor que o banner rende, por mes ou de uma vez, e o fim
    const comValor = validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', valor: '1.234,50', cobranca: 'mensal', terminaEm: '2026-12-31' });
    assert.deepEqual([comValor.valor, comValor.cobranca, comValor.terminaEm], [123450, 'mensal', '2026-12-31']);
    assert.equal(validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', valor: '', cobranca: 'mensal' }).cobranca, null, 'sem valor, sem cobranca');
    assert.throws(() => validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', valor: '100' }), /por mês ou de uma vez/);
    assert.throws(() => validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', valor: 'cem', cobranca: 'unica' }), /150,00/);
    assert.throws(() => validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', terminaEm: '2026-02-30' }), /data de término/);
    assert.throws(() => validarDadosDoBanner({ empresa: 'X', formato: 'horizontal', texto: 'a'.repeat(201) }), /200/);
});

test('o tipo da imagem vem dos primeiros bytes: PNG, JPEG e WebP, e nada de SVG ou GIF', () => {
    assert.equal(tipoDaImagemDoBanner(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
    assert.equal(tipoDaImagemDoBanner(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(tipoDaImagemDoBanner(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
    assert.equal(tipoDaImagemDoBanner(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
    assert.equal(tipoDaImagemDoBanner(Buffer.from('GIF89a')), null);
});

test('as medidas de cada formato: horizontal deitado e vertical em pe', () => {
    for (const [l, a] of [[1280, 400], [970, 250], [728, 90]]) assert.equal(problemaNasMedidas('horizontal', l, a), null, `${l}x${a}`);
    for (const [l, a] of [[400, 1280], [250, 970], [90, 728], [300, 600], [160, 600], [120, 600]]) assert.equal(problemaNasMedidas('vertical', l, a), null, `${l}x${a}`);
    // o vertical e o horizontal em pe: cada medida do horizontal, trocada, tambem serve (doc 97)
    for (const [l, a] of [[1280, 400], [970, 250], [728, 90], [300, 50], [4000, 2000], [4000, 364]]) {
        assert.equal(problemaNasMedidas('horizontal', l, a), null, `${l}x${a} deitado`);
        assert.equal(problemaNasMedidas('vertical', a, l), null, `${a}x${l} em pe`);
    }
    assert.match(problemaNasMedidas('vertical', 300, 450), /2 a 11 vezes/, 'pouco em pe (1,5) nao serve mais');
    assert.match(problemaNasMedidas('vertical', 40, 400), /de 50 a 2000 px de largura/);
    assert.match(problemaNasMedidas('horizontal', 300, 600), /deitado/);
    assert.match(problemaNasMedidas('vertical', 1280, 400), /em pé/);
    assert.match(problemaNasMedidas('horizontal', 200, 50), /de 300 a 4000 px de largura/);
    assert.match(problemaNasMedidas('horizontal', 600, 400), /2 a 11 vezes/);
    assert.equal(problemaNasMedidas('horizontal', 0, 0), 'Não deu para ler as medidas da imagem');
});

test('o relatorio do mes: totais, todos os dias, por banner (com a parte) e por lugar', () => {
    const linhas = [
        { dia: '2026-10-01', banner: 'loja', posicao: 'topo', exibicoes: 100, cliques: 4 },
        { dia: '2026-10-01', banner: 'cafe', posicao: 'lateral', exibicoes: 50, cliques: 1 },
        { dia: '2026-10-15', banner: 'loja', posicao: 'lateral', exibicoes: 50, cliques: 1 },
    ];
    const r = montarRelatorio('2026-10', linhas);
    assert.deepEqual(r.totais, { exibicoes: 200, cliques: 6, taxa: 3 });
    assert.equal(r.porDia.length, 31);
    assert.deepEqual(r.porDia[0], { dia: '2026-10-01', exibicoes: 150, cliques: 5 });
    assert.deepEqual(r.porDia[1], { dia: '2026-10-02', exibicoes: 0, cliques: 0 });
    assert.deepEqual(r.porBanner.map(b => [b.banner, b.exibicoes, b.cliques, b.taxa, b.parte]), [['loja', 150, 5, 3.3, 75], ['cafe', 50, 1, 2, 25]]);
    assert.deepEqual(r.porPosicao.map(p => [p.posicao, p.exibicoes]), [['lateral', 100], ['topo', 100]]);
    assert.deepEqual(montarRelatorio('2026-02', []).totais, { exibicoes: 0, cliques: 0, taxa: null });
    assert.equal(diasDoMes('2028-02').length, 29, 'ano bissexto');
    assert.equal(taxaDeCliques(1, 0), null);
    assert.equal(lerMesDoRelatorio('2026-10'), '2026-10');
    assert.throws(() => lerMesDoRelatorio('2026-13'), /mês válido/);
});

test('a planilha nao deixa celula virar formula', () => {
    assert.equal(celulaDoCsv('Loja "boa"'), '"Loja ""boa"""');
    assert.equal(celulaDoCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(celulaDoCsv('-1+1'), '"\'-1+1"');
    assert.equal(celulaDoCsv(12), '"12"');
    assert.equal(celulaDoCsv(null), '""');
});

test('os lugares do site: as exibicoes que a pagina manda sao conferidas', async () => {
    const { lerExibicoes, LUGARES_DE_BANNER } = await import('../api/_banners.js');
    assert.deepEqual(lerExibicoes({ itens: [{ banner: 'loja-do-otaku', posicao: 'loja-topo' }, { banner: 'x', posicao: 'lugar-inventado' }, { posicao: 'loja-fim' }] }),
        [{ banner: 'loja-do-otaku', posicao: 'loja-topo' }], 'so lugares conhecidos e com banner');
    assert.deepEqual(lerExibicoes({}), []);
    assert.throws(() => lerExibicoes({ itens: Array.from({ length: 13 }, () => ({ banner: 'a', posicao: 'loja-topo' })) }), /demais/);
    assert.equal(LUGARES_DE_BANNER['comunidade-direita'], 'Comunidade, embaixo de Quem seguir');
});

test('o relatorio mostra o nome do lugar', async () => {
    const { montarRelatorio } = await import('../api/_banners.js');
    const relatorio = montarRelatorio('2026-10', [{ dia: '2026-10-18', banner: 'a', posicao: 'loja-esquerda', exibicoes: 5, cliques: 1 }]);
    assert.equal(relatorio.porPosicao[0].posicao, 'Loja, lateral esquerda');
});
