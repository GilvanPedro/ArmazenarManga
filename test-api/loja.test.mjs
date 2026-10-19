// Testes da loja: os itens, a assinatura dos avisos do Mercado Pago e o que cada pagamento faz com a compra.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { COLUNA_DO_TIPO, conferirImagemDaLoja, formatoDaImagem, temaQueExiste, PRECO_DO_TEMA, PRECO_DO_TEMA_ANIMADO, TEMAS_GRATIS, ITENS_DA_LOJA, PRECO_DA_BORDA, PRECO_DO_EFEITO, assinaturaValida, itemDaLoja, podeMudar, situacaoDoPagamento } from '../api/_loja.js';

test('a loja tem pelo menos 4 bordas, todas a R$ 4,50 e com ids que viram classes', () => {
    const bordas = ITENS_DA_LOJA.filter(item => item.tipo === 'borda');
    assert.ok(bordas.length >= 4);
    assert.equal(PRECO_DA_BORDA, 450);
    for (const item of bordas) {
        assert.equal(item.preco, 450, item.id);
        assert.match(item.id, /^[a-z]+$/);
        assert.ok(item.nome && item.descricao);
    }
    assert.equal(new Set(bordas.map(item => item.id)).size, bordas.length, 'ids repetidos');
    assert.equal(itemDaLoja('neon').nome, 'Neon');
    assert.equal(itemDaLoja('nao-existe'), null);
    assert.equal(itemDaLoja('__proto__'), null);
});

test('a loja tem pelo menos 4 efeitos a R$ 2,50, e cada tipo tem a sua coluna', () => {
    const efeitos = ITENS_DA_LOJA.filter(item => item.tipo === 'efeito');
    assert.ok(efeitos.length >= 4);
    assert.equal(PRECO_DO_EFEITO, 250);
    for (const item of efeitos) assert.equal(item.preco, 250, item.id);
    assert.equal(new Set(ITENS_DA_LOJA.map(item => item.id)).size, ITENS_DA_LOJA.length, 'um id nao pode servir para dois itens');
    for (const item of ITENS_DA_LOJA) assert.ok(Object.hasOwn(COLUNA_DO_TIPO, item.tipo), item.id);
    assert.ok(!ITENS_DA_LOJA.some(item => item.id === 'brilho'), 'o brilho e o de sempre: nao se vende');
});

test('a assinatura do aviso confere so com o segredo, o id, o request-id e o ts certos', () => {
    const segredo = 'segredo-de-teste';
    const assinar = manifesto => createHmac('sha256', segredo).update(manifesto).digest('hex');
    const v1 = assinar('id:123456;request-id:abc-1;ts:1700000000;');
    const certo = { assinatura: `ts=1700000000,v1=${v1}`, requestId: 'abc-1', dataId: '123456', segredo };
    assert.equal(assinaturaValida(certo), true);
    assert.equal(assinaturaValida({ ...certo, assinatura: ` ts=1700000000 , v1=${v1.toUpperCase()}` }), true, 'espacos e maiusculas');
    assert.equal(assinaturaValida({ ...certo, dataId: '654321' }), false, 'outro pagamento');
    assert.equal(assinaturaValida({ ...certo, requestId: 'outro' }), false);
    assert.equal(assinaturaValida({ ...certo, segredo: 'outro' }), false);
    assert.equal(assinaturaValida({ ...certo, assinatura: 'ts=1700000001,v1=' + v1 }), false, 'outro ts');
    assert.equal(assinaturaValida({ ...certo, assinatura: null }), false);
    assert.equal(assinaturaValida({ ...certo, assinatura: 'lixo' }), false);
    // id com letras: conferido em minusculas
    const comLetras = assinar('id:abc123;request-id:r;ts:1;');
    assert.equal(assinaturaValida({ assinatura: 'ts=1,v1=' + comLetras, requestId: 'r', dataId: 'ABC123', segredo }), true);
});

test('so pagamento aprovado com R$ 4,50 em reais entrega a borda', () => {
    const compra = { preco: 450 };
    assert.equal(situacaoDoPagamento({ status: 'approved', transaction_amount: 4.5, currency_id: 'BRL' }, compra), 'aprovada');
    assert.equal(situacaoDoPagamento({ status: 'approved', transaction_amount: 0.01, currency_id: 'BRL' }, compra), 'divergente');
    assert.equal(situacaoDoPagamento({ status: 'approved', transaction_amount: 4.5, currency_id: 'USD' }, compra), 'divergente');
    assert.equal(situacaoDoPagamento({ status: 'pending' }, compra), 'pendente');
    assert.equal(situacaoDoPagamento({ status: 'in_process' }, compra), 'pendente');
    assert.equal(situacaoDoPagamento({ status: 'rejected' }, compra), 'recusada');
    assert.equal(situacaoDoPagamento({ status: 'cancelled' }, compra), 'recusada');
    assert.equal(situacaoDoPagamento({ status: 'refunded' }, compra), 'reembolsada');
    assert.equal(situacaoDoPagamento({ status: 'charged_back' }, compra), 'reembolsada');
    assert.equal(situacaoDoPagamento(null, compra), 'pendente');
});

test('a compra so anda para a frente: aprovada so vira reembolsada, e nada volta a pendente', () => {
    assert.equal(podeMudar('pendente', 'aprovada'), true);
    assert.equal(podeMudar('recusada', 'aprovada'), true, 'tentou de novo e pagou');
    assert.equal(podeMudar('aprovada', 'reembolsada'), true);
    assert.equal(podeMudar('aprovada', 'recusada'), false, 'uma tentativa recusada depois nao tira o que foi pago');
    assert.equal(podeMudar('aprovada', 'pendente'), false);
    assert.equal(podeMudar('reembolsada', 'aprovada'), false);
    assert.equal(podeMudar('aprovada', 'aprovada'), false);
    assert.equal(podeMudar('divergente', 'aprovada'), false);
});

test('temas: os de cor a R$ 5,00, os animados a R$ 7,50, e o escuro e o claro de graca (e fora da loja)', () => {
    const temas = ITENS_DA_LOJA.filter(item => item.tipo === 'tema');
    assert.equal(PRECO_DO_TEMA, 500);
    assert.equal(PRECO_DO_TEMA_ANIMADO, 750);
    assert.ok(temas.filter(item => !item.animado).length >= 5);
    assert.ok(temas.filter(item => item.animado).length >= 1);
    for (const item of temas) assert.equal(item.preco, item.animado ? 750 : 500, item.id);
    assert.deepEqual(TEMAS_GRATIS.map(item => item.id), ['escuro', 'claro']);
    for (const gratis of TEMAS_GRATIS) assert.equal(itemDaLoja(gratis.id), null, gratis.id + ' nao se compra');
});

test('um tema que saiu da loja nao fica preso na conta: vira o Automatico', () => {
    assert.equal(temaQueExiste('cosmos'), 'cosmos');
    assert.equal(temaQueExiste('claro'), 'claro');
    assert.equal(temaQueExiste('silhueta'), null, 'o Silhueta saiu da loja');
    assert.equal(temaQueExiste('neon'), null, 'neon e uma borda, nao um tema');
    assert.equal(temaQueExiste(null), null);
});

test('imagens da loja: o formato vem dos primeiros bytes e tem que bater com o nome', async () => {
    const sharp = (await import('sharp')).default;
    const base = sharp({ create: { width: 4, height: 6, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    const webp = await base.clone().webp().toBuffer();
    const png = await base.clone().png().toBuffer();
    const gif = await base.clone().gif().toBuffer();
    assert.equal(formatoDaImagem(webp), 'image/webp');
    assert.equal(formatoDaImagem(png), 'image/png');
    assert.equal(formatoDaImagem(gif), 'image/gif');
    assert.equal(formatoDaImagem(Buffer.from('<svg></svg>')), null);
    assert.equal(conferirImagemDaLoja('celestial.webp', webp), 'image/webp');
    assert.equal(conferirImagemDaLoja('moldura-2.png', png), 'image/png');
    assert.throws(() => conferirImagemDaLoja('celestial.png', webp), /é WEBP, mas o nome termina em \.png/);
    for (const ruim of ['Celestial.webp', 'a b.webp', '../x.webp', 'x.svg', 'x.webp.exe', '-x.webp', '']) {
        assert.throws(() => conferirImagemDaLoja(ruim, webp), /Nome inválido/, ruim);
    }
    assert.throws(() => conferirImagemDaLoja('x.webp', Buffer.alloc(0)), /Envie o arquivo/);
    assert.throws(() => conferirImagemDaLoja('x.webp', Buffer.from('nao e imagem')), /não é uma imagem/);
    assert.throws(() => conferirImagemDaLoja('x.webp', Buffer.alloc(3 * 1024 * 1024 + 1)), /3 MB/);
});

test('videos da loja: WebM e MP4 pelo conteudo, e o envio por pedaco (doc 108)', async () => {
    const { conferirImagemDaLoja, respostaDoArquivo } = await import('../api/_loja.js');
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(60)]);
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(60)]);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]);
    assert.equal(conferirImagemDaLoja('fundo-1.webm', webm), 'video/webm');
    assert.equal(conferirImagemDaLoja('fundo-1.mp4', mp4), 'video/mp4');
    assert.equal(conferirImagemDaLoja('fundo-1.jpg', jpg), 'image/jpeg');
    assert.throws(() => conferirImagemDaLoja('fundo-1.mp4', webm), /é WEBM, mas o nome termina em \.mp4/);
    assert.throws(() => conferirImagemDaLoja('fundo.mov', mp4), /Nome inválido/);

    const inteiro = respostaDoArquivo(mp4, 'video/mp4', null);
    assert.equal(inteiro.status, 200);
    assert.match(inteiro.headers.get('cache-control'), /max-age=604800/);
    assert.equal(inteiro.headers.get('accept-ranges'), 'bytes');
    const comeco = respostaDoArquivo(mp4, 'video/mp4', 'bytes=0-9');
    assert.equal(comeco.status, 206);
    assert.equal(comeco.headers.get('content-range'), `bytes 0-9/${mp4.length}`);
    assert.equal((await comeco.arrayBuffer()).byteLength, 10);
    const fim = respostaDoArquivo(mp4, 'video/mp4', 'bytes=-4');
    assert.equal(fim.headers.get('content-range'), `bytes ${mp4.length - 4}-${mp4.length - 1}/${mp4.length}`);
    assert.equal(respostaDoArquivo(mp4, 'video/mp4', 'bytes=9999-').status, 416);
    assert.match(respostaDoArquivo(jpg, 'image/jpeg', null).headers.get('cache-control'), /max-age=3600/, 'imagem continua uma hora');
});

test('roleta: chances 5:3:1, sem tipo que acabou, e o sorteio pelos pesos (doc 115)', async () => {
    const { chancesDaRoleta, sortearDaRoleta, girosDaCompra, PRECO_DO_GIRO, GIROS_POR_VEZ } = await import('../api/_loja.js');
    assert.equal(PRECO_DO_GIRO, 500);
    assert.equal(GIROS_POR_VEZ, 3);
    const chances = chancesDaRoleta(ITENS_DA_LOJA);
    assert.ok(Math.abs(chances.borda - 5 / 9) < 1e-9 && Math.abs(chances.efeito - 3 / 9) < 1e-9 && Math.abs(chances.tema - 1 / 9) < 1e-9);
    // sem nenhum tema faltando, a chance do tema se divide entre borda e efeito
    const semTema = ITENS_DA_LOJA.filter(item => item.tipo !== 'tema');
    assert.deepEqual(Object.keys(chancesDaRoleta(semTema)).sort(), ['borda', 'efeito']);
    assert.ok(Math.abs(chancesDaRoleta(semTema).borda - 5 / 8) < 1e-9);
    assert.equal(sortearDaRoleta([]), null);
    // o primeiro numero escolhe o tipo: 0 = borda, 0,6 = efeito, 0,95 = tema
    assert.equal(sortearDaRoleta(ITENS_DA_LOJA, (() => { const n = [0, 0]; return () => n.shift(); })()).tipo, 'borda');
    assert.equal(sortearDaRoleta(ITENS_DA_LOJA, (() => { const n = [0.6, 0]; return () => n.shift(); })()).tipo, 'efeito');
    assert.equal(sortearDaRoleta(ITENS_DA_LOJA, (() => { const n = [0.95, 0.999]; return () => n.shift(); })()).tipo, 'tema');
    // 9.000 giros: perto de 5/9, 3/9 e 1/9
    const contagem = { borda: 0, efeito: 0, tema: 0 };
    for (let i = 0; i < 9000; i++) contagem[sortearDaRoleta(ITENS_DA_LOJA).tipo]++;
    assert.ok(Math.abs(contagem.borda - 5000) < 300 && Math.abs(contagem.efeito - 3000) < 300 && Math.abs(contagem.tema - 1000) < 200, JSON.stringify(contagem));
    assert.equal(girosDaCompra('giros-3'), 3);
    assert.equal(girosDaCompra('giros-4'), 0);
    assert.equal(girosDaCompra('neon'), 0);
});
