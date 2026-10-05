// Testes da busca de descricao da API do Vercel. As fontes da internet sao trocadas por respostas prontas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarBuscadorDeSinopse, emPedacos, limpar } from '../api/_sinopse.js';

function internetFalsa({ mangadex = { data: [] }, anilist = { data: { Page: { media: [] } } }, tradutorFunciona = true } = {}) {
    const traduzidos = [];
    return {
        traduzidos,
        async get(endereco) {
            if (endereco.startsWith('https://api.mangadex.org/')) return mangadex;
            if (endereco.startsWith('https://api.mymemory.translated.net/')) {
                const texto = new URL(endereco).searchParams.get('q');
                traduzidos.push(texto);
                return tradutorFunciona
                    ? { responseStatus: 200, responseData: { translatedText: '[pt] ' + texto } }
                    : { responseStatus: '429', responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } };
            }
            return null;
        },
        async postJson(endereco) {
            return endereco === 'https://graphql.anilist.co' ? anilist : null;
        },
    };
}
const doMangaDex = (titulo, descricoes, alternativos = []) => ({ data: [{ attributes: { title: { en: titulo }, altTitles: alternativos, description: descricoes } }] });
const doAniList = (titulo, descricao) => ({ data: { Page: { media: [{ title: { romaji: 'Romaji', english: titulo }, description: descricao }] } } });

test('usa a descricao em portugues do MangaDex sem traduzir', async () => {
    const internet = internetFalsa({ mangadex: doMangaDex('Solo Leveling', { en: 'Ten years ago...', 'pt-br': 'Dez anos atrás, o Portal se abriu.' }) });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('  Solo Leveling '),
        { descricao: 'Dez anos atrás, o Portal se abriu.', idioma: 'pt', fonte: 'MangaDex', tituloEncontrado: 'Solo Leveling', traduzida: false, tags: [] });
    assert.deepEqual(internet.traduzidos, []);
});

test('quando so ha ingles, traduz a descricao do AniList', async () => {
    const internet = internetFalsa({
        mangadex: doMangaDex('Doomsday Wedding', { en: 'English from MangaDex.' }),
        anilist: doAniList('Doomsday Wedding!', 'Forced onto a team with her rival.<br><br>She would rather fight.<br>(Source: Tapas)'),
    });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('Doomsday Wedding'), {
        descricao: '[pt] Forced onto a team with her rival.\n\n[pt] She would rather fight.',
        idioma: 'pt', fonte: 'AniList', tituloEncontrado: 'Doomsday Wedding!', traduzida: true, tags: [],
    });
});

test('usa o ingles do MangaDex quando o AniList nao conhece', async () => {
    const internet = internetFalsa({ mangadex: doMangaDex('Obra Rara', { en: 'Only here.' }) });
    const sinopse = await criarBuscadorDeSinopse(internet)('Obra Rara');

    assert.equal(sinopse.descricao, '[pt] Only here.');
    assert.equal(sinopse.fonte, 'MangaDex');
});

test('se a traducao falhar, devolve em ingles avisando', async () => {
    const internet = internetFalsa({ anilist: doAniList('Obra', 'Some story.'), tradutorFunciona: false });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('Obra'),
        { descricao: 'Some story.', idioma: 'en', fonte: 'AniList', tituloEncontrado: 'Obra', traduzida: false, tags: [] });
});

test('nao encontra quando nenhuma fonte conhece ou os servicos estao fora do ar', async () => {
    assert.equal(await criarBuscadorDeSinopse(internetFalsa())('zzzz'), null);
    assert.equal(await criarBuscadorDeSinopse(internetFalsa())('  '), null);
    assert.equal(await criarBuscadorDeSinopse(internetFalsa({ mangadex: null, anilist: null }))('Solo Leveling'), null);
    assert.equal(await criarBuscadorDeSinopse(internetFalsa({ mangadex: 'texto', anilist: { erro: true } }))('Solo Leveling'), null);
});

test('entre varios resultados, prefere o que tem exatamente o titulo', async () => {
    const internet = internetFalsa({ mangadex: { data: [
        { attributes: { title: { en: 'Solo Leveling: Ragnarok' }, altTitles: [], description: { 'pt-br': 'Errada.' } } },
        { attributes: { title: { 'ko-ro': 'Na Honjaman Level-Up' }, altTitles: [{ en: 'Solo Leveling' }], description: { 'pt-br': 'Certa.' } } },
    ] } });
    const sinopse = await criarBuscadorDeSinopse(internet)('solo  leveling');

    assert.equal(sinopse.descricao, 'Certa.');
    assert.equal(sinopse.tituloEncontrado, 'solo  leveling');
});

test('limpa marcacoes e o que vem depois da descricao', () => {
    assert.equal(limpar('**Uma história** com [link](https://x.com).<br><br><br>\n<i>Segundo parágrafo</i> &amp; fim.\n\n---\n**Links:**\n- [Site](https://y.com)'),
        'Uma história com link.\n\nSegundo parágrafo & fim.');
    assert.equal(limpar(null), '');
    assert.equal(limpar('   '), '');
});

test('descricao longa e cortada no fim de uma frase e traduzida em pedacos', async () => {
    const frase = 'This sentence has exactly fifty characters in it. ';
    const internet = internetFalsa({ anilist: doAniList('Longa', frase.repeat(60).trim()) });

    const sinopse = await criarBuscadorDeSinopse(internet)('Longa');

    assert.ok(internet.traduzidos.length >= 3 && internet.traduzidos.length <= 8, 'pedidos: ' + internet.traduzidos.length);
    for (const pedaco of internet.traduzidos) {
        assert.ok(pedaco.length <= 450 && pedaco.endsWith('.'), pedaco);
    }
    assert.ok(!sinopse.descricao.includes('  '));
    assert.deepEqual(emPedacos('curto'), ['curto']);
});
