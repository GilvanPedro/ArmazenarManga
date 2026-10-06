// Testes das recomendacoes da API do Vercel. O AniList e trocado por respostas prontas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarBuscadorDeRecomendacoes, nomesDoLink, variacoesDoTitulo } from '../api/_recomendacoes.js';

const obra = (id, ingles, romaji, generos = [], mais = {}) => ({ id, type: 'MANGA', isAdult: false, title: { romaji, english: ingles }, synonyms: [],
    genres: generos, siteUrl: 'https://anilist.co/manga/' + id, coverImage: { large: 'https://s4.anilist.co/capa' + id + '.jpg' }, ...mais });
function anilistFalso({ media = null, porGenero = [], generos = ['Action'], temas = [], obrasDaLista = { data: { m0: { media: [] } } }, obrasPeloIngles = { data: { m0: { media: [] } } }, exploracao = { data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } },
    temasDoAniList = { data: { MediaTagCollection: [{ name: 'Villainess', isAdult: false }, { name: 'Wuxia', isAdult: false }, { name: 'Tema Adulto', isAdult: true }] } } } = {}) {
    const perguntas = [];
    const perguntasSobreALista = [];
    const perguntasDeExploracao = [];
    return {
        perguntas,
        perguntasSobreALista,
        perguntasDeExploracao,
        async get() { return null; },
        async postJson(endereco, corpo) {
            // "a que obra corresponde cada titulo da lista" (m0, m1...)
            if (corpo.query.includes('MediaTagCollection')) return temasDoAniList;
            if (corpo.query.includes('pageInfo')) {
                perguntasDeExploracao.push(corpo);
                return exploracao;
            }
            if (corpo.query.includes('m0:Page(perPage:2)')) {
                perguntasSobreALista.push(corpo);
                return obrasPeloIngles;
            }
            if (corpo.query.includes('m0:Page')) {
                perguntasSobreALista.push(corpo);
                return obrasDaLista;
            }
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

test('descobre os outros nomes dos mangas da lista', async () => {
    const anilist = anilistFalso({ obrasDaLista: { data: {
        m0: { media: [{ id: 109957, title: { romaji: 'Dubeon Saneun Ranker', english: 'Second Life Ranker', native: '두 번 사는 랭커' }, synonyms: ['Ranker Who Lives a Second Time'] }] },
        m1: { media: [{ id: 119257, title: { romaji: 'Jeonjijeok Dokja Sijeom', english: 'Omniscient Reader', native: null }, synonyms: [] }] },
        m2: { media: [] }, m3: { media: [] } } } });
    // o terceiro titulo (em portugues) so o MangaDex conhece; o quarto, ninguem
    anilist.get = async endereco => endereco.includes('title=o%20come') ? { data: [
        { attributes: { title: { en: 'Outra Obra Parecida' }, altTitles: [{ 'pt-br': 'O Começo de Tudo' }] } },
        { attributes: { title: { en: 'The Beginning After the End' }, altTitles: [{ 'pt-br': 'O Começo Depois do Fim' }, { ja: '最強の王様' }] } }] }
        : endereco.includes('mymemory') ? { responseStatus: 200, responseData: { translatedText: new URL(endereco).searchParams.get('q') } } : { data: [] };
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    const nomes = await buscar.nomesAlternativos(['Ranker Who Lives a Second Time', 'Ponto de Vista do Leitor (relendo)', 'o começo depois do fim', 'Titulo Que Ninguem Conhece']);

    assert.deepEqual(nomes.get('Ranker Who Lives a Second Time'), ['anilist:109957', 'Dubeon Saneun Ranker', 'Second Life Ranker', '두 번 사는 랭커', 'Ranker Who Lives a Second Time']);
    assert.deepEqual(nomes.get('Ponto de Vista do Leitor (relendo)'), ['anilist:119257', 'Jeonjijeok Dokja Sijeom', 'Omniscient Reader']);
    assert.deepEqual(nomes.get('o começo depois do fim'), ['The Beginning After the End', 'O Começo Depois do Fim', '最強の王様']);
    assert.deepEqual(nomes.get('Titulo Que Ninguem Conhece'), []);
    assert.equal(anilist.perguntasSobreALista[0].variables.t1, 'Ponto de Vista do Leitor');
});

test('servico fora do ar nao marca nenhum titulo como resolvido', async () => {
    assert.equal((await criarBuscadorDeRecomendacoes(anilistFalso({ obrasDaLista: null })).nomesAlternativos(['Solo Leveling'])).size, 0);
    // AniList respondeu que nao conhece, mas o MangaDex falhou (get devolve null): fica para tentar de novo
    assert.equal((await criarBuscadorDeRecomendacoes(anilistFalso()).nomesAlternativos(['Solo Leveling'])).size, 0);
    assert.equal((await criarBuscadorDeRecomendacoes(anilistFalso()).nomesAlternativos([])).size, 0);
});

test('nao sugere obra cadastrada com outro nome ou em outra lingua', async () => {
    const anilist = anilistFalso({ media: [obra(109957, 'Second Life Ranker', 'Dubeon Saneun Ranker'), obra(119257, 'Omniscient Reader', 'Jeonjijeok Dokja Sijeom'),
        obra(300, 'The Beginning After the End', 'TBATE'), obra(301, 'Re:ZERO -Starting Life in Another World-', 'Re:Zero kara Hajimeru Isekai Seikatsu'),
        obra(302, 'The Legend of the Northern Blade', 'Bukgeom Jeongi'), obra(555, 'Realmente Nova', 'Realmente Nova')] });
    const cadastrados = ['Ranker que Vive Duas Vezes', 'anilist:109957', 'Ponto de Vista do Leitor', 'Omniscient Reader',
        'O Começo Depois do Fim', 'The Beginning After The End', 'ReZero Starting Life in Another World', 'Legend of the Northern Blade'];

    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilist)('Solo Leveling', cadastrados)), ['Realmente Nova']);
});

test('observacao entre parenteses nao atrapalha, e nomes parecidos de obras diferentes nao se confundem', async () => {
    const media = [obra(10, 'Tower of God', 'Sin-ui Tap'), obra(11, 'Outro', 'Outro')];
    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilistFalso({ media }))('Solo Leveling', ['Tower of God (parei no 300) [PT]'])), ['Outro']);
    const continuacoes = [obra(10, 'Solo Leveling: Ragnarok', 'x'), obra(11, 'Tower of God: Urek Mazino', 'y')];
    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilistFalso({ media: continuacoes }))('Solo Leveling', ['Solo Leveling', 'Tower of God', 'anilist:999'])),
        ['Solo Leveling: Ragnarok', 'Tower of God: Urek Mazino']);
});

test('titulo em portugues que ninguem conhece e traduzido e procurado de novo', async () => {
    const traducoes = { 'Ponto de Vista do Leitor Onisciente': "Omniscient Reader's Viewpoint", 'Titulo Sem Obra': 'Title Without Work' };
    const anilist = anilistFalso({
        obrasDaLista: { data: { m0: { media: [] }, m1: { media: [] }, m2: { media: [] } } },
        obrasPeloIngles: { data: { m0: { media: [{ id: 119257, title: { romaji: 'Jeonjijeok Dokja Sijeom', english: 'Omniscient Reader', native: null }, synonyms: [] },
            { id: 900, title: { romaji: 'ORV Novel', english: null, native: null }, synonyms: [] }] }, m1: { media: [] } } },
    });
    let tradutorFunciona = true;
    anilist.get = async endereco => {
        if (!endereco.includes('mymemory')) return { data: [] };
        const titulo = new URL(endereco).searchParams.get('q');
        return tradutorFunciona ? { responseStatus: 200, responseData: { translatedText: traducoes[titulo] ?? titulo } } : null;
    };
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    const nomes = await buscar.nomesAlternativos(['Ponto de Vista do Leitor Onisciente (relendo)', 'Titulo Sem Obra', 'Already In English']);

    assert.deepEqual(nomes.get('Ponto de Vista do Leitor Onisciente (relendo)'),
        ['anilist:119257', 'anilist:900', 'Jeonjijeok Dokja Sijeom', 'Omniscient Reader', 'ORV Novel', "Omniscient Reader's Viewpoint"]);
    assert.deepEqual(nomes.get('Titulo Sem Obra'), []);
    assert.deepEqual(nomes.get('Already In English'), []);
    assert.deepEqual(anilist.perguntasSobreALista.at(-1).variables, { t0: "Omniscient Reader's Viewpoint", t1: 'Title Without Work' });
    tradutorFunciona = false;
    assert.equal((await buscar.nomesAlternativos(['Outro Titulo em Portugues'])).size, 0);
});

test('tira nomes do link de leitura, e eles batem com os nomes das candidatas', async () => {
    assert.deepEqual(nomesDoLink('https://asurascans.com/comics/omniscient-readers-viewpoint-3ec3b16f/chapter/{cap}'), ['omniscient readers viewpoint']);
    assert.deepEqual(nomesDoLink('https://comix.to/title/0vx0d-doomsday-wedding/6880186-chapter-{cap}'), ['doomsday wedding']);
    assert.deepEqual(nomesDoLink('https://site.com/manga/solo_leveling/capitulo-{cap}?x=outra-coisa-aqui'), ['solo leveling']);
    assert.deepEqual(nomesDoLink('https://site.com/read/8f3a9c'), []);
    assert.deepEqual(nomesDoLink('https://site.com/manga/berserk/chapter-{cap}'), []);
    assert.deepEqual(nomesDoLink(null), []);
    const media = [obra(119257, 'Omniscient Reader', 'Jeonjijeok Dokja Sijeom', [], { synonyms: ["Omniscient Reader's Viewpoint"] }), obra(11, 'Outro', 'Outro')];
    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilistFalso({ media }))('Solo Leveling', ['Ponto de Vista do Leitor', 'omniscient readers viewpoint'])), ['Outro']);
});

test('mesmas palavras com ligacoes diferentes sao o mesmo nome', async () => {
    const media = [obra(10, 'Ponto de Vista de um Leitor Onisciente', 'x'), obra(11, 'The Return of the Hero', 'y'), obra(12, 'Solo Leveling: Ragnarok', 'z')];
    assert.deepEqual(titulos(await criarBuscadorDeRecomendacoes(anilistFalso({ media }))('Solo Leveling', ['Ponto de Vista do Leitor Onisciente', 'Return of Hero', 'Solo Leveling'])),
        ['Solo Leveling: Ragnarok']);
});

test('busca geral filtra por nome e tags na ordem pedida', async () => {
    const anilist = anilistFalso({ exploracao: { data: { Page: { pageInfo: { hasNextPage: true }, media: [
        obra(20, 'Villains Are Destined to Die', 'Akyeogui Ending', ['Fantasy', 'Romance'], { averageScore: 84, startDate: { year: 2020 } }),
        obra(21, null, 'Sem Nota', ['Fantasy'], { averageScore: null, startDate: { year: null } })] } } } });
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    const pagina = await buscar.explorar(' vilã ', ['fantasy', 'Romance', 'Villainess', 'Murim', 'Minha Tag Inventada', ' '], 'NOTA', 3, []);

    assert.deepEqual(pagina.itens[0], { titulo: 'Villains Are Destined to Die', capa: 'https://s4.anilist.co/capa20.jpg', generos: ['Fantasia', 'Romance'],
        link: 'https://anilist.co/manga/20', tags: ['Fantasy', 'Romance'], nota: 84, ano: 2020 });
    assert.deepEqual([pagina.itens[1].titulo, pagina.itens[1].nota, pagina.itens[1].ano], ['Sem Nota', null, null]);
    assert.deepEqual([pagina.pagina, pagina.temMais, pagina.ocultos, pagina.tagsIgnoradas], [3, true, 0, ['Minha Tag Inventada']]);
    assert.deepEqual(anilist.perguntasDeExploracao[0].variables, { p: 3, o: ['SCORE_DESC'], s: 'vilã', g: ['Fantasy', 'Romance'], t: ['Villainess', 'Wuxia'] });
    assert.ok(anilist.perguntasDeExploracao[0].query.includes('isAdult:false'));
});

test('busca geral sem filtros mostra as mais populares, e esconde o que ja esta na lista', async () => {
    const anilist = anilistFalso({ exploracao: { data: { Page: { pageInfo: { hasNextPage: false }, media: [obra(105398, 'Solo Leveling', 'Na Honjaman Level Up'),
        obra(119257, 'Omniscient Reader', 'Jeonjijeok Dokja Sijeom'), obra(85143, 'Tower of God', 'Sin-ui Tap'), obra(30, 'Nova', 'Nova'), obra(31, 'Anime', 'Anime', [], { type: 'ANIME' })] } } } });
    const buscar = criarBuscadorDeRecomendacoes(anilist);

    const pagina = await buscar.explorar('', [], 'RELEVANCIA', 0, ['Solo Leveling', 'Ponto de Vista do Leitor', 'anilist:119257', 'Torre de Deus', 'tower of god']);

    assert.deepEqual(titulos(pagina.itens), ['Nova']);
    assert.deepEqual([pagina.ocultos, pagina.temMais, pagina.pagina], [3, false, 1]);
    assert.deepEqual(anilist.perguntasDeExploracao[0].variables, { p: 1, o: ['POPULARITY_DESC'] });
    assert.ok(!/search:|genre_in|tag_in/.test(anilist.perguntasDeExploracao[0].query));
    await buscar.explorar('solo', [], 'RELEVANCIA', 1, []);
    assert.deepEqual(anilist.perguntasDeExploracao[1].variables.o, ['SEARCH_MATCH']);
    await buscar.explorar('', [], 'ORDEM_QUE_NAO_EXISTE', 1, []);
    assert.deepEqual(anilist.perguntasDeExploracao[2].variables.o, ['POPULARITY_DESC']);
});

test('busca geral com o servico fora do ar volta vazia', async () => {
    const pagina = await criarBuscadorDeRecomendacoes({ get: async () => null, postJson: async () => null }).explorar('solo', ['Fantasy', 'Tema Sem Conferir'], 'NOTA', 1, []);

    assert.deepEqual(pagina, { itens: [], pagina: 1, temMais: false, ocultos: 0, tagsIgnoradas: [] });
});
