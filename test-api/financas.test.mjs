// Testes das financas: os lancamentos, em que meses cada um conta e as fatias da pizza.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DadoInvalidoNasFinancas, fatiasDaPizza, mesesQueContaram, totalAte, lerMes, lerValor, somarMeses, totalNoMes, validarLancamento, valeNoMes } from '../api/_financas.js';

test('um gasto mensal comeca num mes e pode ter um ultimo mes', () => {
    assert.deepEqual(validarLancamento({ tipo: 'gasto', nome: '  Claude   Pro ', valor: 11000, recorrencia: 'mensal', inicio: '2026-08' }),
        { tipo: 'gasto', nome: 'Claude Pro', valor: 11000, recorrencia: 'mensal', inicio: '2026-08-01', fim: null });
    assert.equal(validarLancamento({ tipo: 'gasto', nome: 'Neon', valor: 100, recorrencia: 'mensal', inicio: '2026-08', fim: '2026-10' }).fim, '2026-10-01');
    assert.throws(() => validarLancamento({ tipo: 'gasto', nome: 'Neon', valor: 100, recorrencia: 'mensal', inicio: '2026-08', fim: '2026-07' }), /antes do primeiro/);
});

test('uma receita de uma vez so vale no dia ou no mes informado', () => {
    assert.equal(validarLancamento({ tipo: 'receita', nome: 'Anúncio', valor: 5000, recorrencia: 'unica', inicio: '2026-10-15' }).inicio, '2026-10-15');
    assert.equal(validarLancamento({ tipo: 'receita', nome: 'Anúncio', valor: 5000, recorrencia: 'unica', inicio: '2026-10' }).inicio, '2026-10-01');
    assert.throws(() => validarLancamento({ tipo: 'receita', nome: 'Anúncio', valor: 5000, recorrencia: 'unica', inicio: '2026-02-30' }), DadoInvalidoNasFinancas);
});

test('dados ruins sao recusados com uma mensagem clara', () => {
    const base = { tipo: 'gasto', nome: 'Vercel', valor: 100, recorrencia: 'mensal', inicio: '2026-10' };
    for (const [campo, ruim, mensagem] of [['tipo', 'lucro', /gasto ou uma receita/], ['recorrencia', 'anual', /mensal ou de uma vez/],
        ['nome', '   ', /Dê um nome/], ['nome', 'x'.repeat(61), /no máximo 60/], ['valor', 0, /entre R\$ 0,01/], ['valor', 1.5, /entre/],
        ['valor', 100_000_001, /entre/], ['valor', '12,50', /entre/], ['inicio', '2026-13', /mês de início/], ['inicio', '1999-01', /válido/]]) {
        assert.throws(() => validarLancamento({ ...base, [campo]: ruim }), mensagem, `${campo}=${ruim}`);
    }
    assert.throws(() => validarLancamento(null), /Dados inválidos/);
    assert.equal(lerValor('450'), 450);
    assert.equal(lerMes('2026-01'), '2026-01');
});

test('em que meses cada lancamento conta, e o total do mes', () => {
    const vercel = { recorrencia: 'mensal', inicio: '2026-08-01', fim: null, valor: 10000 };
    const neon = { recorrencia: 'mensal', inicio: '2026-08-01', fim: '2026-09-01', valor: 2000 };
    const anuncio = { recorrencia: 'unica', inicio: '2026-10-15', fim: null, valor: 5000 };
    assert.equal(valeNoMes(vercel, '2026-07'), false);
    assert.equal(valeNoMes(vercel, '2027-03'), true, 'sem fim: continua');
    assert.equal(valeNoMes(neon, '2026-09'), true, 'o ultimo mes conta');
    assert.equal(valeNoMes(neon, '2026-10'), false);
    assert.equal(valeNoMes(anuncio, '2026-10'), true);
    assert.equal(valeNoMes(anuncio, '2026-11'), false);
    assert.equal(totalNoMes([vercel, neon, anuncio], '2026-09'), 12000);
    assert.equal(totalNoMes([vercel, neon, anuncio], '2026-10'), 15000);
    assert.equal(somarMeses('2026-12', 1), '2027-01');
    assert.equal(somarMeses('2026-01', -11), '2025-02');
});

test('a pizza: maiores primeiro, nomes iguais juntos e no maximo 6 fatias', () => {
    assert.deepEqual(fatiasDaPizza([{ nome: 'Neon', valor: 100 }, { nome: 'Vercel', valor: 300 }, { nome: 'Neon', valor: 100 }, { nome: 'Zero', valor: 0 }]),
        [{ nome: 'Vercel', valor: 300 }, { nome: 'Neon', valor: 200 }]);
    const muitas = Array.from({ length: 8 }, (_, i) => ({ nome: 'Item ' + i, valor: (i + 1) * 100 }));
    const fatias = fatiasDaPizza(muitas);
    assert.equal(fatias.length, 6);
    assert.deepEqual(fatias.at(-1), { nome: 'Outros (3)', valor: 600, outros: true });
    assert.equal(fatias.reduce((soma, item) => soma + item.valor, 0), 3600, 'nada se perde');
    assert.deepEqual(fatiasDaPizza([]), []);
});

test('o geral: quantos meses cada lancamento contou ate hoje, e o total', () => {
    const vercel = { recorrencia: 'mensal', inicio: '2026-08-01', fim: null, valor: 100 };
    const render = { recorrencia: 'mensal', inicio: '2025-11-01', fim: '2026-02-01', valor: 50 };
    const dominio = { recorrencia: 'unica', inicio: '2026-09-03', fim: null, valor: 40 };
    const futuro = { recorrencia: 'unica', inicio: '2026-11-10', fim: null, valor: 999 };
    assert.equal(mesesQueContaram(vercel, '2026-10'), 3);
    assert.equal(mesesQueContaram(render, '2026-10'), 4, 'de novembro a fevereiro, virando o ano');
    assert.equal(mesesQueContaram(dominio, '2026-10'), 1);
    assert.equal(mesesQueContaram(futuro, '2026-10'), 0, 'o que ainda nao chegou nao conta');
    assert.equal(totalAte([vercel, render, dominio, futuro], '2026-10'), 300 + 200 + 40);
});
