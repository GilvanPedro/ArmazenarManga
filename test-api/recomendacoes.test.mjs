// Testes das recomendacoes da API do Vercel. O AniList e trocado por respostas prontas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarBuscadorDeRecomendacoes, variacoesDoTitulo } from '../api/_recomendacoes.js';

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

    assert.deepEqual(recomendacoes[0], { titulo: 'Tower of God', capa: 'https://s4.anilist.co/capa10.jpg', generos: ['Ação', 'Fantasia', 'Ficção científica', 'Gênero Novo'], link: 'https://anilist.co/manga/10', tags: ['Action', 'Fantasy', 'Sci-Fi', 'Gênero Novo'] });
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

test('titulo com subtitulo ou observacao e tentado em versoes mais curtas', async () => {
    assert.deepEqual(variacoesDoTitulo('Solo Leveling: Ragnarok (Novel) [PT-BR]'), ['Solo Leveling: Ragnarok (Novel) [PT-BR]', 'Solo Leveling: Ragnarok', 'Solo Leveling']);
    assert.deepEqual(variacoesDoTitulo(' One Piece '), ['One Piece']);
    const soONomeCurto = { get: async () => null, postJson: async (e, corpo) => corpo.variables.s === 'Solo Leveling'
        ? { data: { Media: { id: 1, genres: ['Action'], tags: [], recommendations: { nodes: [{ mediaRecommendation: obra(10, 'Tower of God', 'Sin-ui Tap') }] } } } }
        : { data: { Media: null, Page: { media: [] } } } };

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(soONomeCurto)('Solo Leveling (meu preferido)', [])), ['Tower of God']);
});

test('quando o titulo nao e conhecido, procura pelas tags do manga', async () => {
    const anilist = anilistFalso({ porGenero: [obra(20, 'Pela Tag', 'x', ['Fantasy']), obra(21, 'Pelas Duas', 'y', ['Fantasy', 'Romance'])] });
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    assert.deepEqual(titulos(await buscar('Titulo Que Ninguem Conhece', [], ['fantasy', 'Romance', 'Villainess', 'Murim', '  '])), ['Pelas Duas', 'Pela Tag']);
    assert.deepEqual(anilist.perguntas.at(-1).variables, { g: ['Fantasy', 'Romance'], t: ['Villainess', 'Wuxia'] });
    assert.deepEqual(await buscar('Outro Que Ninguem Conhece', [], []), []);
});

test('as tags completam o que veio do titulo, e fazem parte do que fica guardado', async () => {
    const anilist = anilistFalso({ generos: [], media: [obra(10, 'Dos Leitores', 'Dos Leitores')], porGenero: [obra(20, 'Pela Tag', 'x', ['Action']), obra(10, 'Dos Leitores', 'Dos Leitores')] });
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    assert.deepEqual(titulos(await buscar('Solo Leveling', [], ['Action'])), ['Dos Leitores', 'Pela Tag']);
    const antes = anilist.perguntas.length;
    await buscar('Solo Leveling', [], ['action']);
    assert.equal(anilist.perguntas.length, antes);
    await buscar('Solo Leveling', [], ['Romance']);
    assert.ok(anilist.perguntas.length > antes);
});

test('tema que o AniList nao tem nao impede a busca pelos generos', async () => {
    const semOTema = { get: async () => null, postJson: async (e, corpo) => corpo.query.includes('Media(search') ? { data: { Media: null } }
        : { data: { Page: { media: corpo.query.includes('tag_in') ? [] : [obra(20, 'So Pelo Genero', 'x', ['Action'])] } } } };

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(semOTema)('Desconhecido', [], ['Action', 'Tag Inventada'])), ['So Pelo Genero']);
});
