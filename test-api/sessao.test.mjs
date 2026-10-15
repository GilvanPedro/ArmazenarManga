// Testes do login de 30 dias da API do Vercel.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COOKIE, DURACAO_SEGUNDOS, criarSessao, lerCookie, mesmoTexto, segredoDoTexto, textoDoCookie, validarSessao } from '../api/_sessao.js';

const SEGREDO = Buffer.alloc(32);
const AGORA = Date.parse('2026-10-14T12:00:00Z');
const DIA = 24 * 60 * 60 * 1000;

test('o login vale trinta dias e so neles', () => {
    const cookie = criarSessao(SEGREDO, 'manga', 'senha', AGORA);

    assert.equal(validarSessao(cookie, SEGREDO, 'manga', 'senha', AGORA).getTime(), AGORA + 30 * DIA);
    // desligar o computador nao importa: o que conta e a data
    assert.ok(validarSessao(cookie, SEGREDO, 'manga', 'senha', AGORA + 29 * DIA));
    assert.equal(validarSessao(cookie, SEGREDO, 'manga', 'senha', AGORA + 30 * DIA), null);
    assert.notEqual(cookie, criarSessao(SEGREDO, 'manga', 'senha', AGORA), 'cada login e diferente');
    assert.equal(DURACAO_SEGUNDOS, 2592000);
});

test('cookie alterado, de outro segredo ou de outra senha nao vale', () => {
    const cookie = criarSessao(SEGREDO, 'manga', 'senha', AGORA);
    const [versao, expira, aleatorio, assinatura] = cookie.split('.');
    const outroSegredo = Buffer.alloc(32, 1);

    assert.equal(validarSessao(cookie, outroSegredo, 'manga', 'senha', AGORA), null);
    assert.equal(validarSessao(cookie, SEGREDO, 'manga', 'outra senha', AGORA), null);
    assert.equal(validarSessao(cookie, SEGREDO, 'outro', 'senha', AGORA), null);
    assert.equal(validarSessao([versao, Number(expira) + 86400, aleatorio, assinatura].join('.'), SEGREDO, 'manga', 'senha', AGORA), null);
    for (const falso of [null, undefined, '', 'v1', 'v2.' + [expira, aleatorio, assinatura].join('.'), 'v1.abc.x.y', 'v1.1.x.y.z', cookie + 'x', 'x'.repeat(300)]) {
        assert.equal(validarSessao(falso, SEGREDO, 'manga', 'senha', AGORA), null, String(falso));
    }
    // assinado com o relogio adiantado: nao pode durar mais que 30 dias a partir de agora
    assert.equal(validarSessao(criarSessao(SEGREDO, 'manga', 'senha', AGORA + 10 * DIA), SEGREDO, 'manga', 'senha', AGORA), null);
});

test('assina igual a versao Java', () => {
    // o mesmo exemplo esta em web/SessoesTest.java: um login feito em uma versao vale na outra
    const cookie = 'v1.4102444800.AAAAAAAAAAAAAAAAAAAAAA.o-xRWlGWdm-0f59GWX_zwLhpGESpksXB9Hhk7vwO1MQ';
    const expira = validarSessao(cookie, Buffer.alloc(32, 1), 'manga', 'sênha-de-teste', 4102444800 * 1000 - DIA);
    assert.equal(expira.getTime(), 4102444800 * 1000);
});

test('le o cookie certo e monta o cabecalho de gravar', () => {
    assert.equal(lerCookie('outro=1; mangas_sessao=v1.2.x.y ; mais=3', COOKIE), 'v1.2.x.y');
    assert.equal(lerCookie('mangas_sessao_falso=1', COOKIE), null);
    assert.equal(lerCookie(null, COOKIE), null);
    assert.equal(textoDoCookie('abc', 60, true), 'mangas_sessao=abc; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure');
    assert.equal(textoDoCookie('', 0, false), 'mangas_sessao=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
});

test('comparacao de textos e segredo da variavel', () => {
    assert.ok(mesmoTexto('sênha', 'sênha'));
    assert.ok(!mesmoTexto('senha', 'sênha'));
    assert.ok(!mesmoTexto('a', undefined));
    assert.equal(segredoDoTexto('curto'), null);
    assert.equal(segredoDoTexto(undefined), null);
    assert.equal(segredoDoTexto('x'.repeat(40)).length, 40);
});
