// Testes da busca de descricao da API do Vercel. As fontes da internet sao trocadas por respostas prontas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarBuscadorDeSinopse, criarTradutorDeDescricao, emPedacos, juntarTags, limpar, nomeDaTag, pareceIngles } from '../api/_sinopse.js';

// uma "traducao" de mentira que sai mesmo em portugues: as palavras comuns do ingles viram as do portugues
const PARA_O_PORTUGUES = { the: 'o', and: 'e', of: 'de', to: 'para', is: 'é', his: 'seu', her: 'sua', with: 'com', that: 'que', was: 'foi',
    she: 'ela', he: 'ele', they: 'eles', are: 'são', would: 'iria', but: 'mas', has: 'tem', in: 'em', it: 'isso', this: 'este', only: 'só', here: 'aqui' };
export const traduzirDeMentira = texto => texto.replace(/[A-Za-z]+/g, palavra => PARA_O_PORTUGUES[palavra.toLowerCase()] ?? palavra);

/**
 * tradutores: quais funcionam ('google', 'gtx', 'mymemory'). Por padrao, so o MyMemory (como os testes antigos);
 * 'lixo' faz o MyMemory devolver o proprio texto em ingles.
 */
function internetFalsa({ mangadex = { data: [] }, anilist = { data: { Page: { media: [] } } }, mangaupdates = null, jikan = null, kitsu = null,
    tradutorFunciona = true, tradutores = ['mymemory'], mymemoryLixo = false } = {}) {
    const traduzidos = [];
    const pedidos = [];
    return {
        traduzidos,
        pedidos,
        async get(endereco) {
            if (endereco.startsWith('https://api.mangadex.org/')) return mangadex;
            if (endereco.startsWith('https://api.jikan.moe/')) return jikan;
            if (endereco.startsWith('https://kitsu.io/')) return kitsu;
            const texto = endereco.includes('q=') ? new URL(endereco).searchParams.get('q') : '';
            if (endereco.startsWith('https://clients5.google.com/')) {
                pedidos.push('google');
                return tradutores.includes('google') ? [traduzirDeMentira(texto)] : null;
            }
            if (endereco.startsWith('https://translate.googleapis.com/')) {
                pedidos.push('gtx');
                return tradutores.includes('gtx') ? [[[traduzirDeMentira(texto), texto]]] : null;
            }
            if (endereco.startsWith('https://api.mymemory.translated.net/')) {
                pedidos.push('mymemory');
                traduzidos.push(texto);
                if (mymemoryLixo) return { responseStatus: 200, responseData: { translatedText: texto } };
                return tradutorFunciona && tradutores.includes('mymemory')
                    ? { responseStatus: 200, responseData: { translatedText: traduzirDeMentira(texto) } }
                    : { responseStatus: '429', responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } };
            }
            return null;
        },
        async postJson(endereco) {
            if (endereco === 'https://api.mangaupdates.com/v1/series/search') return mangaupdates;
            return endereco === 'https://graphql.anilist.co' ? anilist : null;
        },
    };
}
const doMangaDex = (titulo, descricoes, alternativos = []) => ({ data: [{ attributes: { title: { en: titulo }, altTitles: alternativos, description: descricoes } }] });
const doAniList = (titulo, descricao) => ({ data: { Page: { media: [{ title: { romaji: 'Romaji', english: titulo }, description: descricao }] } } });

test('usa a descricao em portugues do MangaDex sem traduzir', async () => {
    const internet = internetFalsa({ mangadex: doMangaDex('Solo Leveling', { en: 'Ten years ago...', 'pt-br': 'Dez anos atrás, o Portal se abriu.' }) });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('  Solo Leveling '),
        { descricao: 'Dez anos atrás, o Portal se abriu.', idioma: 'pt', fonte: 'MangaDex', tituloEncontrado: 'Solo Leveling', traduzida: false, tags: [], fontes: ['MangaDex'] });
    assert.deepEqual(internet.traduzidos, []);
});

test('quando so ha ingles, traduz a descricao do AniList', async () => {
    const internet = internetFalsa({
        mangadex: doMangaDex('Doomsday Wedding', { en: 'English from MangaDex.' }),
        anilist: doAniList('Doomsday Wedding!', 'Forced onto a team with her rival.<br><br>She would rather fight.<br>(Source: Tapas)'),
    });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('Doomsday Wedding'), {
        descricao: 'Forced onto a team com sua rival.\n\nela iria rather fight.',
        idioma: 'pt', fonte: 'AniList', tituloEncontrado: 'Doomsday Wedding', traduzida: true, tags: [], fontes: ['MangaDex', 'AniList'],
    });
});

test('usa o ingles do MangaDex quando o AniList nao conhece', async () => {
    const internet = internetFalsa({ mangadex: doMangaDex('Obra Rara', { en: 'Only here.' }) });
    const sinopse = await criarBuscadorDeSinopse(internet)('Obra Rara');

    assert.equal(sinopse.descricao, 'só aqui.');
    assert.equal(sinopse.fonte, 'MangaDex');
});

test('se a traducao falhar, devolve em ingles avisando', async () => {
    const internet = internetFalsa({ anilist: doAniList('Obra', 'Some story.'), tradutorFunciona: false });

    assert.deepEqual(await criarBuscadorDeSinopse(internet)('Obra'),
        { descricao: 'Some story.', idioma: 'en', fonte: 'AniList', tituloEncontrado: 'Obra', traduzida: false, tags: [], fontes: ['AniList'] });
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

test('traduz primeiro pelo Google; os outros so quando ele falha (doc 102)', async () => {
    const anilist = doAniList('Obra', 'She is the hero of the story and she has a sword.');
    const comGoogle = internetFalsa({ anilist, tradutores: ['google', 'gtx', 'mymemory'] });
    assert.equal((await criarBuscadorDeSinopse(comGoogle)('Obra')).descricao, 'ela é o hero de o story e ela tem a sword.');
    assert.deepEqual(comGoogle.pedidos, ['google'], 'uma chamada so, com o texto inteiro');

    const soGtx = internetFalsa({ anilist, tradutores: ['gtx'] });
    assert.equal((await criarBuscadorDeSinopse(soGtx)('Obra')).idioma, 'pt');
    assert.deepEqual(soGtx.pedidos, ['google', 'gtx']);
});

test('traducao que volta em ingles (o MyMemory devolvendo o mesmo texto) nao vale', async () => {
    const internet = internetFalsa({ anilist: doAniList('Obra', 'She is the hero of the story and she has a sword.'), mymemoryLixo: true });
    const sinopse = await criarBuscadorDeSinopse(internet)('Obra');
    assert.equal(sinopse.idioma, 'en');
    assert.equal(sinopse.traduzida, false);
});

test('descricao "em portugues" do MangaDex que esta em ingles e traduzida', async () => {
    const internet = internetFalsa({ mangadex: doMangaDex('Obra', { 'pt-br': 'He is the strongest and he has a plan for the world.' }), tradutores: ['google'] });
    const sinopse = await criarBuscadorDeSinopse(internet)('Obra');
    assert.equal(sinopse.idioma, 'pt');
    assert.equal(sinopse.traduzida, true);
    assert.equal(sinopse.descricao, 'ele é o strongest e ele tem a plan for o world.');
});

test('ao salvar: descricao em ingles vira portugues; em portugues passa direto (doc 102)', async () => {
    const internet = internetFalsa({ tradutores: ['google'] });
    const paraPortugues = criarTradutorDeDescricao(internet);
    assert.equal(await paraPortugues('She is the hero of the story and she has a sword.'), 'ela é o hero de o story e ela tem a sword.');
    assert.equal(await paraPortugues('Ela é a heroína da história e tem uma espada.'), 'Ela é a heroína da história e tem uma espada.');
    assert.deepEqual(internet.pedidos, ['google'], 'o texto em portugues nao chama o tradutor');
    assert.equal(await criarTradutorDeDescricao(internetFalsa({ tradutores: [] }))('She is the hero of the story and she has a sword.'),
        'She is the hero of the story and she has a sword.', 'sem tradutor, fica como veio');
});

test('o que parece ingles', () => {
    assert.equal(pareceIngles('Ten years ago, the Gate opened and they are known as Hunters.'), true);
    assert.equal(pareceIngles('Dez anos atrás, o Portão se abriu e eles são conhecidos como Caçadores.'), false);
    assert.equal(pareceIngles('Solo Leveling'), false, 'curto demais para dizer');
    assert.equal(pareceIngles(''), false);
});

test('junta as tags de todas as fontes que acharam a mesma obra (doc 103)', async () => {
    const internet = internetFalsa({
        tradutores: ['google'],
        // o AniList conhece pelo nome pesquisado; o MangaUpdates por outro nome, que o Kitsu liga aos dois
        anilist: { data: { Page: { media: [{ title: { english: 'Raising Villains the Right Way', romaji: 'Akdangdeurui Huwonjaga Doeeotda' },
            synonyms: [], genres: ['Action', 'Fantasy'], description: 'He is a noble and he has a plan.',
            tags: [{ name: 'Isekai', rank: 90 }, { name: 'Full Color', rank: 95 }, { name: 'Twist', rank: 80, isMediaSpoiler: true }, { name: 'Magic', rank: 40 }] }] } } },
        mangaupdates: { results: [
            { hit_title: 'The Patron of Villains', record: { title: 'The Patron of Villains', type: 'Manhwa', genres: [{ genre: 'Action' }, { genre: 'Comedy' }, { genre: 'Shonen' }], description: 'From Tapas:\nOne day.' } },
            { hit_title: 'Raising Villains the Right Way', record: { title: 'Raising Villains (Novel)', type: 'Novel', genres: [{ genre: 'Romance' }] } },
        ] },
        kitsu: { data: [{ attributes: { canonicalTitle: 'Akdangdeurui Huwonjaga Doeeotda', titles: { en: 'The Patron of Villains' } },
            relationships: { categories: { data: [{ id: '1' }, { id: '2' }] } } }],
        included: [{ type: 'categories', id: '1', attributes: { title: 'Dark Fantasy' } }, { type: 'categories', id: '2', attributes: { title: 'Isekai' } }] },
        jikan: { data: [{ title: 'Outra Obra Qualquer', genres: [{ name: 'Horror' }] }] },
    });
    const sinopse = await criarBuscadorDeSinopse(internet)('Raising Villains the Right Way');
    assert.deepEqual(sinopse.fontes, ['AniList', 'MangaUpdates', 'Kitsu'], 'o MyAnimeList achou outra obra; a novel do MangaUpdates fica de fora');
    // Action e Isekai vem de duas fontes cada (primeiro); Full Color (formato), o spoiler, o tema fraco e o Horror da outra obra ficam de fora
    assert.deepEqual(sinopse.tags, ['Action', 'Isekai', 'Fantasy', 'Comedy', 'Shounen', 'Dark Fantasy']);
    assert.equal(sinopse.fonte, 'AniList');
    assert.equal(sinopse.tituloEncontrado, 'Raising Villains the Right Way');
});

test('a descricao vem da fonte seguinte quando o AniList nao tem; e o "From X:" do MangaUpdates sai', async () => {
    const internet = internetFalsa({
        tradutores: ['google'],
        mangaupdates: { results: [{ hit_title: 'Obra Rara', record: { title: 'Obra Rara', type: 'Manhwa', genres: [], description: 'From Yen Press:\nShe is the hero of the story.' } }] },
    });
    const sinopse = await criarBuscadorDeSinopse(internet)('Obra Rara');
    assert.equal(sinopse.fonte, 'MangaUpdates');
    assert.equal(sinopse.descricao, 'ela é o hero de o story.');
});

test('os nomes das tags: o mesmo genero com um nome so, sem as de formato', () => {
    assert.equal(nomeDaTag('Shonen'), 'Shounen');
    assert.equal(nomeDaTag('Sci Fi'), 'Sci-Fi');
    assert.equal(nomeDaTag('Yaoi'), "Boys' Love");
    assert.equal(nomeDaTag('Female Harem'), 'Harem');
    assert.equal(nomeDaTag('Long Strip'), null);
    assert.equal(nomeDaTag('Male Protagonist'), null);
    assert.equal(nomeDaTag('dark fantasy'), 'Dark fantasy');
    assert.deepEqual(juntarTags([['Action', 'Shonen'], ['Shounen', 'action', 'Romance'], ['Romance']]), ['Action', 'Shounen', 'Romance']);
    assert.equal(juntarTags([Array.from({ length: 20 }, (_, i) => 'Tag ' + i)]).length, 12);
});
