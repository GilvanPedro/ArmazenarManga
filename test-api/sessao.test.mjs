// Testes do login de 30 dias da API do Vercel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COOKIE, DURACAO_SEGUNDOS, contaDoCookie, criarSessao, lerCookie, mesmoTexto, segredoDoTexto, textoDoCookie, validarSessao } from '../api/_sessao.js';

const SEGREDO = Buffer.alloc(32);
const CONTA = '0a1b2c3d-1111-4222-8333-444455556666';
const SENHA = 'pbkdf2_sha256$1000$abc$def';
const AGORA = Date.parse('2026-10-14T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;

test('o login vale trinta dias e so neles', () => {
    const cookie = criarSessao(SEGREDO, CONTA, SENHA, AGORA);

    assert.equal(contaDoCookie(cookie), CONTA);
    assert.equal(validarSessao(cookie, SEGREDO, CONTA, SENHA, AGORA).getTime(), AGORA + 30 * DIA);
    // desligar o computador nao importa: o que conta e a data
    assert.ok(validarSessao(cookie, SEGREDO, CONTA, SENHA, AGORA + 29 * DIA));
    assert.equal(validarSessao(cookie, SEGREDO, CONTA, SENHA, AGORA + 30 * DIA), null);
    assert.notEqual(cookie, criarSessao(SEGREDO, CONTA, SENHA, AGORA), 'cada login e diferente');
    assert.equal(DURACAO_SEGUNDOS, 2592000);
});

test('cookie alterado, de outra conta, de outro segredo ou de senha trocada nao vale', () => {
    const cookie = criarSessao(SEGREDO, CONTA, SENHA, AGORA);
    const [versao, conta, expira, aleatorio, assinatura] = cookie.split('.');
    const outra = '0a1b2c3d-1111-4222-8333-999999999999';

    assert.equal(validarSessao(cookie, Buffer.alloc(32, 1), CONTA, SENHA, AGORA), null);
    assert.equal(validarSessao(cookie, SEGREDO, CONTA, 'pbkdf2_sha256$1000$abc$outra', AGORA), null, 'senha trocada');
    assert.equal(validarSessao(cookie, SEGREDO, outra, SENHA, AGORA), null);
    // trocar a conta dentro do cookie invalida a assinatura
    assert.equal(validarSessao([versao, outra, expira, aleatorio, assinatura].join('.'), SEGREDO, outra, SENHA, AGORA), null);
    assert.equal(validarSessao([versao, conta, Number(expira) + 86400, aleatorio, assinatura].join('.'), SEGREDO, CONTA, SENHA, AGORA), null);
    for (const falso of [null, undefined, '', 'v2', 'v1.' + [expira, aleatorio, assinatura].join('.'), `v2.${CONTA}.abc.x.y`, cookie + 'x', 'x'.repeat(400)]) {
        assert.equal(validarSessao(falso, SEGREDO, CONTA, SENHA, AGORA), null, String(falso));
    }
    assert.equal(contaDoCookie('v2.nao-e-id.1.x.y'), null);
    assert.equal(validarSessao(criarSessao(SEGREDO, CONTA, SENHA, AGORA + 10 * DIA), SEGREDO, CONTA, SENHA, AGORA), null);
});

test('assina igual a versao Java', () => {
    // o mesmo exemplo esta em web/SessoesTest.java: um login feito em uma versao vale na outra
    const cookie = 'v2.11111111-2222-4333-8444-555555555555.4102444800.AAAAAAAAAAAAAAAAAAAAAA.oQwgN_CtF6RKQTzy0nu1u-UVaASkKgBce3h6tPctVKU';
    const expira = validarSessao(cookie, Buffer.alloc(32, 1), '11111111-2222-4333-8444-555555555555', 'pbkdf2_sha256$1000$c2Fs$aGFzaA==', 4102444800 * 1000 - DIA);
    assert.equal(expira.getTime(), 4102444800 * 1000);
});

test('le o cookie certo e monta o cabecalho de gravar', () => {
    assert.equal(lerCookie('outro=1; mangas_sessao=v2.a.2.x.y ; mais=3', COOKIE), 'v2.a.2.x.y');
    assert.equal(lerCookie('mangas_sessao_falso=1', COOKIE), null);
    assert.equal(lerCookie(null, COOKIE), null);
    assert.equal(textoDoCookie('abc', 60, true), 'mangas_sessao=abc; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure');
    assert.equal(textoDoCookie('', 0, false), 'mangas_sessao=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
});

test('comparacao de textos e segredo da variavel', () => {
    assert.ok(mesmoTexto('sênha', 'sênha'));
    assert.ok(!mesmoTexto('senha', 'sênha'));
    assert.equal(segredoDoTexto('curto'), null);
    assert.equal(segredoDoTexto('x'.repeat(40)).length, 40);
});
