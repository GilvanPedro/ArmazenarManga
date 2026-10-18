// Testes da moderacao da Comunidade: suspensoes, banimentos, mensagens e o robo de imagens.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { DadoInvalidoNaModeracao, avaliarImagem, dataEHora, mensagemDaPunicao, situacaoDaConta, validarMotivo, validarSuspensao } from '../api/_moderacao.js';
import { verificarImagem } from '../api/_robo_de_imagens.js';

test('suspensao de 1 hora a 1 ano, com motivo opcional de ate 300 caracteres', () => {
    assert.deepEqual(validarSuspensao({ horas: 24, motivo: '  imagens   impróprias ' }), { horas: 24, motivo: 'imagens impróprias' });
    assert.deepEqual(validarSuspensao({ horas: '72' }), { horas: 72, motivo: '' });
    assert.equal(validarSuspensao({ horas: 8760 }).horas, 8760);
    for (const ruim of [0, -1, 1.5, 8761, 'muito', null]) {
        assert.throws(() => validarSuspensao({ horas: ruim }), DadoInvalidoNaModeracao, String(ruim));
    }
    assert.equal(validarMotivo(undefined), '');
    assert.equal(validarMotivo('ñ'.repeat(300)).length, 300);
    assert.throws(() => validarMotivo('x'.repeat(301)), /no máximo 300/);
    assert.throws(() => validarMotivo(42), /Motivo inválido/);
});

test('a punicao que vale: suspensao vencida nao conta, banimento vale ate tirarem', () => {
    const agora = new Date('2026-10-16T12:00:00Z');
    assert.equal(situacaoDaConta(null, agora), null);
    assert.equal(situacaoDaConta({ punicao: null }, agora), null);
    assert.deepEqual(situacaoDaConta({ punicao: 'suspensa', punida_ate: '2026-10-17T12:00:00Z', punicao_motivo: 'spam' }, agora),
        { tipo: 'suspensa', ate: '2026-10-17T12:00:00.000Z', motivo: 'spam' });
    assert.equal(situacaoDaConta({ punicao: 'suspensa', punida_ate: '2026-10-16T11:59:59Z' }, agora), null, 'ja venceu');
    assert.deepEqual(situacaoDaConta({ punicao: 'banida', punida_ate: null, punicao_motivo: null }, agora), { tipo: 'banida', motivo: '' });
});

test('mensagens para quem esta punido, com a data no horario de Brasilia', () => {
    assert.equal(dataEHora('2026-10-18T17:30:00Z'), '18/10/2026 às 14:30');
    assert.match(mensagemDaPunicao({ tipo: 'suspensa', ate: '2026-10-18T17:30:00Z', motivo: 'spam' }),
        /suspensa até 18\/10\/2026 às 14:30 \(horário de Brasília\).*Motivo: spam/);
    assert.match(mensagemDaPunicao({ tipo: 'banida', motivo: '' }), /banida da Comunidade.*até um administrador tirar o banimento\.$/);
});

test('o robo so barra foto explicita de pessoa: desenho, arte e capa de manga sempre passam', () => {
    assert.equal(avaliarImagem({ Porn: 0.95, Drawing: 0.02, Hentai: 0.01, Sexy: 0.02 }).barrar, true, 'foto explicita');
    assert.equal(avaliarImagem({ Porn: 0.6, Neutral: 0.4 }).barrar, true, 'no limite');
    assert.equal(avaliarImagem({ Porn: 0.64, Neutral: 0.17, Sexy: 0.11 }).barrar, true, 'a mais baixa das imagens de teste do doc 88');
    assert.equal(avaliarImagem({ Porn: 0.59, Neutral: 0.41 }).barrar, false, 'abaixo do limite');
    assert.equal(avaliarImagem({ Porn: 0.53, Neutral: 0.47 }).barrar, false, 'a foto comum com a nota mais alta do doc 88');
    assert.equal(avaliarImagem({ Hentai: 0.98, Drawing: 0.02 }).barrar, false, 'desenho explicito e arte: permitido');
    assert.equal(avaliarImagem({ Drawing: 0.86, Hentai: 0.14 }).barrar, false, 'capa de manga');
    assert.equal(avaliarImagem({ Sexy: 0.9, Neutral: 0.1 }).barrar, false, 'foto insinuante, nao explicita');
    assert.equal(avaliarImagem({ Porn: 0.72, Drawing: 0.2, Hentai: 0.08 }).barrar, true);
    // "Porn" alta, mas o desenho pesa mais: e arte
    assert.equal(avaliarImagem({ Porn: 0.45, Hentai: 0.5, Drawing: 0.05 }).barrar, false);
    assert.equal(avaliarImagem({}).barrar, false);
});

test('o robo le a imagem e classifica (PNG, JPG, WEBP e GIF)', { timeout: 60_000 }, async () => {
    const base = sharp({ create: { width: 320, height: 480, channels: 3, background: { r: 40, g: 90, b: 160 } } });
    for (const formato of ['png', 'jpeg', 'webp', 'gif']) {
        const bytes = await base.clone().toFormat(formato).toBuffer();
        const resultado = await verificarImagem(bytes);
        assert.equal(resultado.permitida, true, formato);
        const soma = Object.values(resultado.probabilidades).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(soma - 1) < 0.01, `as notas somam 1 (${formato}: ${soma})`);
    }
    await assert.rejects(() => verificarImagem(Buffer.from('nao e uma imagem')));
});
