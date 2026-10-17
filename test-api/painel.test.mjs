// Testes do painel dos administradores: o que conta como acesso, os dias no horario de Brasilia e as series.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completarDias, completarMeses, diaDeHoje, ehRobo, lerPeriodo } from '../api/_painel.js';

test('robos e programas nao contam como acesso; navegadores contam', () => {
    for (const robo of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'facebookexternalhit/1.1',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36',
        'curl/8.5.0', 'python-requests/2.31', '', null]) {
        assert.equal(ehRobo(robo), true, String(robo));
    }
    assert.equal(ehRobo('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'), false);
    assert.equal(ehRobo('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'), false);
});

test('o dia e o de Brasilia: 1h da manha em UTC ainda e o dia anterior', () => {
    assert.equal(diaDeHoje(new Date('2026-10-17T02:30:00Z')), '2026-10-16');
    assert.equal(diaDeHoje(new Date('2026-10-17T03:00:00Z')), '2026-10-17');
});

test('periodo: so 7, 30 ou 90 dias; o resto vira 30', () => {
    assert.equal(lerPeriodo('7'), 7);
    assert.equal(lerPeriodo('90'), 90);
    for (const ruim of [null, '', '31', '-7', 'muito', '1000']) assert.equal(lerPeriodo(ruim), 30, String(ruim));
});

test('dias e meses sem nada aparecem com zero, do mais antigo para o atual', () => {
    const dias = completarDias('2026-10-17', 3, [{ dia: '2026-10-16', acessos: '5' }], ['acessos', 'contas']);
    assert.deepEqual(dias, [
        { dia: '2026-10-15', acessos: 0, contas: 0 },
        { dia: '2026-10-16', acessos: 5, contas: 0 },
        { dia: '2026-10-17', acessos: 0, contas: 0 },
    ]);
    // virada de mes e de ano
    assert.deepEqual(completarDias('2026-03-01', 2, [], ['x']).map(item => item.dia), ['2026-02-28', '2026-03-01']);
    const meses = completarMeses('2026-02-10', [{ mes: '2025-12', ativos: 4 }], ['ativos']);
    assert.equal(meses.length, 12);
    assert.deepEqual(meses[0], { mes: '2025-03', ativos: 0 });
    assert.deepEqual(meses.at(-3), { mes: '2025-12', ativos: 4 });
    assert.deepEqual(meses.at(-1), { mes: '2026-02', ativos: 0 });
});
