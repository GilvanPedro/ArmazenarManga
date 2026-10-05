// Testes das recomendacoes da API do Vercel. O AniList e trocado por respostas prontas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarBuscadorDeRecomendacoes } from '../api/_recomendacoes.js';

const obra = (id, ingles, romaji, generos = [], mais = {}) => ({ id, type: 'MANGA', isAdult: false, title: { romaji, english: ingles }, synonyms: [],
    genres: generos, siteUrl: 'https://anilist.co/manga/' + id, coverImage: { large: 'https://s4.anilist.co/capa' + id + '.jpg' }, ...mais });
function anilistFalso({ media = null, porGenero = [], generos = ['Action'], temas = [] } = {}) {
    const perguntas = [];
    return {
        perguntas,
        async get() { return null; },
        async postJson(endereco, corpo) {
            perguntas.push(corpo);
            if (corpo.query.includes('Media(search')) {
                return media === null ? { data: { Media: null } }
                    : { data: { Media: { id: 1, genres: generos, tags: temas, recommendations: { nodes: media.map(m => ({ mediaRecommendation: m })) } } } };
            }
            return { data: { Page: { media: porGenero } } };
        },
    };
}
const titulos = lista => lista.map(r => r.titulo);

test('devolve as recomendacoes dos leitores com generos em portugues', async () => {
    const anilist = anilistFalso({ media: [obra(10, 'Tower of God', 'Sin-ui Tap', ['Action', 'Fantasy', 'Sci-Fi', 'Gênero Novo']), obra(11, null, 'Kumo desu ga', ['Slice of Life'])] });
    const recomendacoes = await criarBuscadorDeRecomendacoes(anilist)('Solo Leveling', ['Solo Leveling']);

    assert.deepEqual(recomendacoes[0], { titulo: 'Tower of God', capa: 'https://s4.anilist.co/capa10.jpg', generos: ['Ação', 'Fantasia', 'Ficção científica', 'Gênero Novo'], link: 'https://anilist.co/manga/10' });
    assert.equal(recomendacoes[1].titulo, 'Kumo desu ga');
    assert.equal(anilist.perguntas[0].variables.s, 'Solo Leveling');
});

test('nao sugere o que ja esta cadastrado', async () => {
    const anilist = anilistFalso({ media: [obra(10, 'Tower of God', 'Sin-ui Tap'),
        obra(11, 'Omniscient Reader', 'Jeonjijeok Dokja Sijeom', [], { synonyms: ['ORV', 'Ponto de Vista do Leitor Onisciente'] }),
        obra(12, 'The Beginning After the End', 'TBATE'), obra(13, 'Second Life Ranker', 'Dubeon Saneun Ranker')] });

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilist)('Solo Leveling', ['Solo Leveling', 'tower of god', 'Ponto de Vista do Leitor Onisciente', 'Tbate!'])),
        ['Second Life Ranker']);
});

test('deixa de fora animes, conteudo adulto e repetidos', async () => {
    const anilist = anilistFalso({ media: [obra(10, 'Anime', 'Anime', [], { type: 'ANIME' }), obra(11, 'Adulto', 'Adulto', [], { isAdult: true }),
        obra(12, 'Bom', 'Bom'), obra(12, 'Bom', 'Bom'), obra(1, 'A Propria Obra', 'A Propria Obra'), null] });

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilist)('Solo Leveling', [])), ['Bom']);
});

test('com poucas recomendacoes, completa com obras dos mesmos generos e temas', async () => {
    const anilist = anilistFalso({
        generos: ['Fantasy', 'Romance'],
        temas: [{ name: 'Female Protagonist', rank: 90 }, { name: 'Pouco Marcante', rank: 30 }, { name: 'Marriage', rank: 70 }],
        media: [obra(10, 'Dos Leitores', 'Dos Leitores', ['Fantasy'])],
        porGenero: [obra(20, 'So Um Genero', 'x', ['Fantasy', 'Action']), obra(21, 'Os Dois Generos', 'y', ['Romance', 'Fantasy']), obra(10, 'Dos Leitores', 'Dos Leitores', ['Fantasy'])],
    });

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilist)('Doomsday Wedding', [])), ['Dos Leitores', 'Os Dois Generos', 'So Um Genero']);
    assert.deepEqual(anilist.perguntas[1].variables, { g: ['Fantasy', 'Romance'], t: ['Female Protagonist', 'Marriage'] });
    assert.ok(anilist.perguntas[1].query.includes('isAdult:false'));
});

test('devolve no maximo seis e guarda a consulta', async () => {
    const anilist = anilistFalso({ media: Array.from({ length: 20 }, (_, i) => obra(100 + i, 'Obra ' + i, 'Obra ' + i)) });
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    assert.equal((await buscar('Solo Leveling', [])).length, 6);
    assert.equal(anilist.perguntas.length, 1);
    const depois = await buscar(' solo leveling ', ['Obra 0', 'Obra 1']);
    assert.equal(anilist.perguntas.length, 1);
    assert.equal(depois[0].titulo, 'Obra 2');
    assert.equal(depois.length, 6);
});

test('obra desconhecida ou servico fora do ar nao quebra nada', async () => {
    assert.deepEqual(await criarBuscadorDeRecomendacoes(anilistFalso())('zzzz', []), []);
    assert.deepEqual(await criarBuscadorDeRecomendacoes(anilistFalso())('  ', []), []);
    const foraDoAr = { get: async () => null, postJson: async () => null };
    assert.deepEqual(await criarBuscadorDeRecomendacoes(foraDoAr)('Solo Leveling', []), []);
});
