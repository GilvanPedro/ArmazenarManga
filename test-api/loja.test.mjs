// Testes da loja: os itens, a assinatura dos avisos do Mercado Pago e o que cada pagamento faz com a compra.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { COLUNA_DO_TIPO, ITENS_DA_LOJA, PRECO_DA_BORDA, PRECO_DO_EFEITO, assinaturaValida, itemDaLoja, podeMudar, situacaoDoPagamento } from '../api/_loja.js';

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
