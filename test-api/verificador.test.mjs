// Testes da verificacao de link da API do Vercel. Rodar com: npm test
// Usa um site de mentira em 127.0.0.1 e o mesmo codigo de rede que roda de verdade.
import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { criarBuscador, criarVerificador, derivarModelo, destinoPermitido, mesmoEndereco } from '../api/_verificador.js';

let servidor;
let base;
let paginas = {};
let visitas = [];
let statusPadrao = 404;

before(async () => {
    servidor = http.createServer((req, res) => {
        const caminho = req.url.split('?')[0];
        visitas.push(caminho);
        const pagina = paginas[caminho];
        if (!pagina) {
            res.writeHead(statusPadrao, { 'Content-Type': 'text/html' }).end('<html><title>Page Not Found</title></html>');
        } else if (pagina.destino) {
            res.writeHead(302, { Location: pagina.destino }).end();
        } else {
            res.writeHead(pagina.status || 200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<html><body>' + pagina.html + '</body></html>');
        }
    });
    await new Promise(pronto => servidor.listen(0, '127.0.0.1', pronto));
    base = 'http://127.0.0.1:' + servidor.address().port;
});
after(() => servidor.close());
beforeEach(() => {
    paginas = {};
    visitas = [];
    statusPadrao = 404;
});

const verificar = criarVerificador(criarBuscador({ permitirRedeLocal: true }));
const pagina = (caminho, html) => { paginas[caminho] = { html }; };
const redireciona = (caminho, destino) => { paginas[caminho] = { destino }; };
const manga = (modelo, ultimo, mais = {}) => ({ chapterLinkModel: base + modelo, decimalFormat: 'HIFEN', lastChapter: ultimo, ...mais });

test('confirma o link quando a pagina aponta para o proximo capitulo', async () => {
    pagina('/manga/x/chapter/49', "<a href='/manga/x/chapter/48'>Prev</a> <a href='/manga/x/chapter/50'>Next</a>");
    pagina('/manga/x/chapter/50', 'ok');
    const m = manga('/manga/x/chapter/{cap}', 49);

    assert.deepEqual(await verificar(m), { situacao: 'DISPONIVEL', chapterLinkModel: m.chapterLinkModel, nextChapterUrl: null });
    assert.deepEqual(visitas, ['/manga/x/chapter/49', '/manga/x/chapter/50']); // abriu o ultimo lido e foi ate o proximo
});

test('confirma pelo modelo quando a pagina nao tem links', async () => {
    pagina('/manga/x/chapter/49', "<div id='app'></div>");
    pagina('/manga/x/chapter/50', "<div id='app'></div>");

    assert.equal((await verificar(manga('/manga/x/chapter/{cap}', 49))).situacao, 'DISPONIVEL');
});

test('corrige o modelo quando o site redireciona para um novo id da obra', async () => {
    redireciona('/comics/obra-3ec3b16f/chapter/174', '/comics/obra-bd5bdaf8/chapter/174');
    pagina('/comics/obra-bd5bdaf8/chapter/174', "<a href='/comics/obra-bd5bdaf8/chapter/175'>Next</a>");
    pagina('/comics/obra-bd5bdaf8/chapter/175', 'ok');

    assert.deepEqual(await verificar(manga('/comics/obra-3ec3b16f/chapter/{cap}', 174)),
        { situacao: 'DISPONIVEL', chapterLinkModel: base + '/comics/obra-bd5bdaf8/chapter/{cap}', nextChapterUrl: null });
});

test('corrige o modelo mesmo quando o proximo capitulo ainda nao saiu', async () => {
    redireciona('/comics/obra-3ec3b16f/chapter/174', '/comics/obra-bd5bdaf8/chapter/174');
    pagina('/comics/obra-bd5bdaf8/chapter/174', "<link rel='prev' href='/comics/obra-bd5bdaf8/chapter/173'>");

    assert.deepEqual(await verificar(manga('/comics/obra-3ec3b16f/chapter/{cap}', 174)),
        { situacao: 'NAO_ENCONTRADO', chapterLinkModel: base + '/comics/obra-bd5bdaf8/chapter/{cap}', nextChapterUrl: null });
});

test('guarda o endereco exato quando cada capitulo tem um id', async () => {
    pagina('/title/obra/6880186-chapter-7', "<a class='btn' href='/title/obra/6700000-chapter-6'>Prev</a><a class='btn' href='/title/obra/6912345-chapter-8'>Next</a>");
    pagina('/title/obra/6912345-chapter-8', 'ok');
    const m = manga('/title/obra/6880186-chapter-{cap}', 7);

    assert.deepEqual(await verificar(m),
        { situacao: 'DISPONIVEL', chapterLinkModel: m.chapterLinkModel, nextChapterUrl: base + '/title/obra/6912345-chapter-8' });
    assert.ok(!visitas.includes('/title/obra/6880186-chapter-8')); // nem tenta o link do modelo, que estaria errado
});

test('acha o endereco do proximo capitulo dentro dos dados de uma pagina montada com JavaScript', async () => {
    pagina('/title/obra/6880186-chapter-7', '<div id="app"></div><script>window.__DADOS__ = {"prev":"\\/title\\/obra\\/6700000-chapter-6",'
        + '"next":{"url":"\\/title\\/obra\\/6912345-chapter-8"},"outra":"/title/outra-obra/1-chapter-8"}</script>');
    pagina('/title/obra/6912345-chapter-8', 'ok');

    assert.equal((await verificar(manga('/title/obra/6880186-chapter-{cap}', 7))).nextChapterUrl, base + '/title/obra/6912345-chapter-8');
});

test('segue o link de proximo mesmo sem numero no endereco', async () => {
    pagina('/read/aaa111', "<a href='/read/000zzz'>Capítulo anterior</a> <a href='/read/bbb222'>Próximo capítulo</a>");
    pagina('/read/bbb222', 'ok');

    const resultado = await verificar(manga('/read/{cap}', 49, { lastChapterUrl: base + '/read/aaa111' }));

    assert.equal(resultado.nextChapterUrl, base + '/read/bbb222');
});

test('usa o endereco exato ja guardado quando a pagina nao mostra o link', async () => {
    pagina('/title/obra/222-chapter-8', "<div id='app'></div>");
    pagina('/title/obra/333-chapter-9', 'ok');

    const resultado = await verificar(manga('/title/obra/111-chapter-{cap}', 8,
        { lastChapterUrl: base + '/title/obra/222-chapter-8', nextChapterUrl: base + '/title/obra/333-chapter-9' }));

    assert.deepEqual(resultado, { situacao: 'DISPONIVEL', chapterLinkModel: base + '/title/obra/111-chapter-{cap}', nextChapterUrl: base + '/title/obra/333-chapter-9' });
});

test('ignora links de outras obras, de outros sites e que nao sao enderecos', async () => {
    pagina('/manga/minha-obra/chapter/49', "<a href='/manga/outra-obra-qualquer/chapter/50'>Outra obra - cap 50</a>"
        + "<a href='https://outro-site.com/manga/minha-obra/chapter/50'>Next</a><a href='javascript:void(0)'>Next</a> <a href='#'>Próximo</a>");
    const m = manga('/manga/minha-obra/chapter/{cap}', 49);

    assert.deepEqual(await verificar(m), { situacao: 'NAO_ENCONTRADO', chapterLinkModel: m.chapterLinkModel, nextChapterUrl: null });
    assert.ok(!visitas.includes('/manga/outra-obra-qualquer/chapter/50'));
});

test('pagina inicial no lugar do capitulo conta como nao encontrado', async () => {
    pagina('/manga/x/chapter/49', 'sem links');
    redireciona('/manga/x/chapter/50', '/manga/x');
    pagina('/manga/x', 'pagina da obra');

    assert.equal((await verificar(manga('/manga/x/chapter/{cap}', 49))).situacao, 'NAO_ENCONTRADO');
});

test('link quebrado quando nem o capitulo atual abre, menos para manga nao comecado', async () => {
    assert.equal((await verificar(manga('/manga/x/chapter/{cap}', 49))).situacao, 'LINK_QUEBRADO');
    assert.equal((await verificar(manga('/manga/x/chapter/{cap}', 0))).situacao, 'NAO_ENCONTRADO');
});

test('site que bloqueia ou esta fora do ar nao muda nada', async () => {
    const m = manga('/manga/x/chapter/{cap}', 49, { nextChapterUrl: base + '/guardado' });
    for (const status of [403, 429, 503]) {
        statusPadrao = status;
        assert.deepEqual(await verificar(m), { situacao: 'NAO_VERIFICADO', chapterLinkModel: m.chapterLinkModel, nextChapterUrl: null });
    }
    const foraDoAr = { chapterLinkModel: 'http://127.0.0.1:1/manga/{cap}', decimalFormat: 'HIFEN', lastChapter: 5 };
    assert.equal((await verificar(foraDoAr)).situacao, 'NAO_VERIFICADO');
});

test('redirecionamento sem fim nao trava', async () => {
    redireciona('/manga/x/chapter/49', '/manga/x/chapter/49');
    redireciona('/manga/x/chapter/50', '/manga/x/chapter/50');

    assert.equal((await verificar(manga('/manga/x/chapter/{cap}', 49))).situacao, 'NAO_VERIFICADO');
    assert.ok(visitas.length <= 14);
});

test('deriva o modelo trocando o numero do capitulo', () => {
    assert.equal(derivarModelo('https://s.com/comics/obra-bd5bdaf8/chapter/174', 174, 'HIFEN'), 'https://s.com/comics/obra-bd5bdaf8/chapter/{cap}');
    assert.equal(derivarModelo('https://s.com/manga/x/capitulo-48-5/', 48.5, 'HIFEN'), 'https://s.com/manga/x/capitulo-{cap}/');
    assert.equal(derivarModelo('https://s.com/ler?manga=7&cap=12', 12, 'HIFEN'), 'https://s.com/ler?manga=7&cap={cap}');
    assert.equal(derivarModelo('https://comix.to/title/0vx0d-doomsday-wedding/6880186-chapter-7', 7, 'HIFEN'), 'https://comix.to/title/0vx0d-doomsday-wedding/6880186-chapter-{cap}');
    assert.equal(derivarModelo('https://174.com/obra/chapter/174.html', 174, 'HIFEN'), 'https://174.com/obra/chapter/{cap}.html');
    for (const endereco of ['https://s.com/comics/obra/chapter/1745', 'https://s.com/comics/obra/chapter/2174', 'https://s.com/comics/obra-a174b/', 'https://174.com/obra', 'https://s.com']) {
        assert.equal(derivarModelo(endereco, 174, 'HIFEN'), null, endereco);
    }
});

test('compara enderecos ignorando detalhes', () => {
    assert.ok(mesmoEndereco('https://Site.com/a/b/', 'https://site.com/a/b#topo'));
    assert.ok(!mesmoEndereco('https://site.com/a/B', 'https://site.com/a/b'));
    assert.ok(!mesmoEndereco('https://site.com/a', null));
});

test('so sites publicos: recusa a rede interna do servidor', async () => {
    const internos = ['http://127.0.0.1/', 'http://localhost/', 'http://[::1]/', 'http://0.0.0.0/', 'http://10.0.0.5/admin', 'http://172.16.0.1/',
        'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/', 'http://100.64.0.1/', 'http://[fd00::1]/', 'http://[fe80::1]/',
        'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://93.184.216.34:22/', 'http://93.184.216.34:8080/', 'ftp://93.184.216.34/', 'file:///etc/passwd'];
    const buscarDeVerdade = criarBuscador();
    for (const endereco of internos) {
        assert.equal(await destinoPermitido(endereco), false, endereco);
        assert.equal((await buscarDeVerdade(endereco)).status, 0, endereco);
    }
    assert.equal(await destinoPermitido('https://93.184.216.34/manga/x/chapter/1'), true);
    assert.equal(await destinoPermitido('http://[2606:2800:220:1:248:1893:25c8:1946]/'), true);
});

test('em producao nao abre o site falso local', async () => {
    pagina('/manga/x/chapter/49', "<a href='/manga/x/chapter/50'>Next</a>");
    pagina('/manga/x/chapter/50', 'ok');

    const resultado = await criarVerificador(criarBuscador())(manga('/manga/x/chapter/{cap}', 49));

    assert.equal(resultado.situacao, 'NAO_VERIFICADO');
    assert.deepEqual(visitas, []);
});
