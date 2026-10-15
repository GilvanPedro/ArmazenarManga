// Testes das regras das contas da API do Vercel: e-mail, nick, senha e o hash da senha.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DadoInvalido, gerarHash, normalizarEmail, senhaConfere, validarEmail, validarNick, validarSenha } from '../api/_contas.js';

test('e-mail e guardado em minusculas e precisa parecer um e-mail', () => {
    assert.equal(validarEmail('  Gilvan@Exemplo.COM '), 'gilvan@exemplo.com');
    assert.equal(normalizarEmail(' A@B.C '), 'a@b.c');
    for (const ruim of ['', '   ', 'sem-arroba', 'a@b', 'a b@c.com', '@c.com', null, 42, 'x'.repeat(250) + '@a.com']) {
        assert.throws(() => validarEmail(ruim), DadoInvalido, String(ruim));
    }
});

test('nick e obrigatorio, sem espacos sobrando e com no maximo 40 caracteres', () => {
    assert.equal(validarNick('  Leitor   de   Manhwa '), 'Leitor de Manhwa');
    assert.equal(validarNick('ñ'.repeat(40)), 'ñ'.repeat(40));
    assert.throws(() => validarNick('   '), /Escolha um nick/);
    assert.throws(() => validarNick('x'.repeat(41)), /no máximo 40/);
    assert.throws(() => validarNick(undefined), DadoInvalido);
});

test('senha precisa ter pelo menos 6 caracteres', () => {
    assert.equal(validarSenha('123456'), '123456');
    assert.equal(validarSenha('      '), '      ', 'espacos contam: a senha e usada como foi digitada');
    assert.throws(() => validarSenha('12345'), /pelo menos 6/);
    assert.throws(() => validarSenha(123456), DadoInvalido);
    assert.throws(() => validarSenha('x'.repeat(201)), /no máximo 200/);
});

test('a senha e guardada so como hash, com sal, e confere so com ela mesma', async () => {
    const hash = await gerarHash('sênha6', 1000);
    assert.match(hash, /^pbkdf2_sha256\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.ok(!hash.includes('sênha6'));
    assert.notEqual(hash, await gerarHash('sênha6', 1000), 'sal diferente a cada vez');
    assert.ok(await senhaConfere('sênha6', hash));
    assert.ok(!(await senhaConfere('senha6', hash)));
    assert.ok(!(await senhaConfere('sênha6', 'texto qualquer')));
    assert.ok(!(await senhaConfere('sênha6', 'pbkdf2_sha256$0$a$b')));
    assert.ok(!(await senhaConfere(undefined, hash)));
});

test('confere hashes feitos pela versao Java', async () => {
    // o mesmo exemplo esta em service/SenhasTest.java
    assert.ok(await senhaConfere('sênha6', 'pbkdf2_sha256$1000$c2FsLWZpeG8tMTZieXRlcw==$Z/s+59UH7LjjIAIhkZA3KMio0qymOImjmjidPWZdky4='));
});
