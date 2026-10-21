// Kitsu: a fonte reserva do Descobrir e das recomendacoes (doc 132), usada quando o AniList nao responde.
// As obras do Kitsu sao entregues no mesmo formato das do AniList (id, title, genres, siteUrl, coverImage...), para o
// resto do codigo (_recomendacoes.js) tratar as duas do mesmo jeito.

const API = 'https://kitsu.io/api/edge';
// o Kitsu so responde a quem pede o formato dele (JSON:API); com "application/json" ele recusa (406)
const JSON_API = { Accept: 'application/vnd.api+json' };
export const POR_PAGINA_NO_KITSU = 20; // o maximo que o Kitsu entrega por pagina
const VALIDADE_DAS_CATEGORIAS_MS = 24 * 60 * 60 * 1000;
// so quadrinhos: sem romances (novel) e doujins
const TIPOS = 'manga,manhwa,manhua,oneshot,oel';
const CAMPOS_DA_OBRA = 'canonicalTitle,titles,abbreviatedTitles,averageRating,userCount,startDate,posterImage,ageRating,slug,categories';

/** As ordens do Descobrir no Kitsu. "Em alta" nao existe la com filtros: vira "mais populares". */
const ORDENS_NO_KITSU = {
    RELEVANCIA: null, // com um nome buscado, o Kitsu ja devolve pelo quanto combina
    POPULARIDADE: '-userCount',
    NOTA: '-averageRating',
    EM_ALTA: '-userCount',
    RECENTES: '-startDate',
    TITULO: 'canonicalTitle',
};

// categoria do Kitsu -> genero com o nome do AniList (o site traduz esses para o portugues)
const GENERO_DA_CATEGORIA = {
    action: 'Action', adventure: 'Adventure', comedy: 'Comedy', drama: 'Drama', fantasy: 'Fantasy', horror: 'Horror',
    mystery: 'Mystery', psychological: 'Psychological', romance: 'Romance', 'science-fiction': 'Sci-Fi',
    'slice-of-life': 'Slice of Life', sports: 'Sports', supernatural: 'Supernatural', thriller: 'Thriller', music: 'Music',
    'magical-girl': 'Mahou Shoujo', mecha: 'Mecha', ecchi: 'Ecchi',
};
// tags do site (e nomes do AniList) que no Kitsu tem outro nome
const CATEGORIA_DA_TAG = {
    'sci fi': 'science-fiction', 'mahou shoujo': 'magical-girl', murim: 'martial-arts', wuxia: 'martial-arts',
    regression: 'time-travel', 'time manipulation': 'time-travel', school: 'school-life', 'female harem': 'harem',
    'male harem': 'reverse-harem',
};
// publico-alvo e marcadores gerais: nao dizem do que a obra trata, entao nao servem para achar parecidas
const CATEGORIAS_GERAIS = new Set(['shounen', 'shoujo', 'seinen', 'josei', 'kids', 'themes', 'setting', 'target-demographics',
    'content-indicators', 'past', 'present', 'future', 'earth', 'japan', 'asia', 'plot-continuity', 'tone-changes', 'dynamic']);

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function criarKitsu(http) {
    let categorias = new Map(); // slug -> { titulo, nsfw }
    let categoriasBuscadasEm = 0;

    /** As categorias do Kitsu (guardadas por um dia); vazio se ele nao respondeu. */
    async function listaDeCategorias() {
        if (categorias.size === 0 || Date.now() - categoriasBuscadasEm > VALIDADE_DAS_CATEGORIAS_MS) {
            const resposta = await http.get(API + '/categories?page%5Blimit%5D=500&fields%5Bcategories%5D=title,slug,nsfw', JSON_API);
            const novas = new Map((Array.isArray(resposta?.data) ? resposta.data : [])
                .filter(item => item?.attributes?.slug)
                .map(item => [item.attributes.slug, { titulo: item.attributes.title, nsfw: item.attributes.nsfw === true }]));
            if (novas.size > 0) {
                categorias = novas;
                categoriasBuscadasEm = Date.now();
            }
        }
        return categorias;
    }

    /** A categoria do Kitsu de uma tag do site ("Martial Arts" -> "martial-arts"); null se o Kitsu nao tem. */
    async function categoriaDaTag(tag) {
        const lista = await listaDeCategorias();
        const normal = normalizar(tag);
        const slug = CATEGORIA_DA_TAG[normal] ?? normal.replaceAll(' ', '-');
        return lista.has(slug) && !lista.get(slug).nsfw ? slug : null;
    }

    /** Uma obra do Kitsu no formato das do AniList; slugs sao as categorias dela. */
    function comoNoAniList(manga, porId) {
        const a = manga?.attributes || {};
        const cats = (manga?.relationships?.categories?.data || []).map(ligacao => porId.get(ligacao.id)).filter(Boolean);
        // sem repetir: o Kitsu as vezes liga a mesma categoria duas vezes
        const generos = [...new Set(cats.map(cat => GENERO_DA_CATEGORIA[cat.slug]).filter(Boolean))];
        const temas = cats.filter(cat => !GENERO_DA_CATEGORIA[cat.slug] && !CATEGORIAS_GERAIS.has(cat.slug)).map(cat => cat.titulo);
        const ano = Number(String(a.startDate || '').slice(0, 4));
        const nota = Number(a.averageRating);
        return {
            id: 'kitsu:' + manga.id,
            type: 'MANGA',
            isAdult: a.ageRating === 'R18' || cats.some(cat => cat.nsfw),
            title: {
                english: a.titles?.en || a.titles?.en_us || null,
                romaji: a.titles?.en_jp || a.canonicalTitle || null,
                native: a.titles?.ja_jp || a.titles?.ko_kr || a.titles?.zh_cn || null,
            },
            synonyms: Array.isArray(a.abbreviatedTitles) ? a.abbreviatedTitles : [],
            genres: [...new Set([...generos, ...temas])].slice(0, 8),
            siteUrl: a.slug ? 'https://kitsu.app/manga/' + a.slug : '',
            coverImage: { large: a.posterImage?.small || a.posterImage?.medium || '' },
            averageScore: Number.isFinite(nota) && nota > 0 ? Math.round(nota) : null,
            popularity: a.userCount || 0,
            startDate: { year: Number.isInteger(ano) && ano > 0 ? ano : null },
            slugs: cats.map(cat => cat.slug),
        };
    }

    /**
     * Uma pagina de obras: pelo nome, com todas as categorias pedidas e em uma ordem. Devolve { obras, temMais } com as
     * obras no formato do AniList, ou null se o Kitsu nao respondeu.
     */
    async function pagina({ nome = '', slugs = [], ordem = 'POPULARIDADE', numero = 1, quantas = POR_PAGINA_NO_KITSU } = {}) {
        await listaDeCategorias();
        const parametros = new URLSearchParams({
            'page[limit]': String(quantas),
            'page[offset]': String((Math.max(1, numero) - 1) * quantas),
            'filter[subtype]': TIPOS,
            include: 'categories',
            'fields[categories]': 'slug',
            'fields[manga]': CAMPOS_DA_OBRA,
        });
        if (nome) parametros.set('filter[text]', nome.slice(0, 100));
        if (slugs.length > 0) parametros.set('filter[categories]', slugs.join(','));
        const ordemNoKitsu = nome && ordem === 'RELEVANCIA' ? null : (ORDENS_NO_KITSU[ordem] ?? '-userCount');
        if (ordemNoKitsu) parametros.set('sort', ordemNoKitsu);
        const resposta = await http.get(API + '/manga?' + parametros, JSON_API);
        if (!Array.isArray(resposta?.data)) return null;
        // as categorias que vieram junto, pelo id (o titulo e o nsfw vem da lista guardada)
        const porId = new Map((resposta.included || []).filter(item => item?.type === 'categories').map(item => {
            const slug = item.attributes?.slug;
            const conhecida = categorias.get(slug);
            return [item.id, { slug, titulo: conhecida?.titulo || slug, nsfw: conhecida?.nsfw === true }];
        }));
        return { obras: resposta.data.map(manga => comoNoAniList(manga, porId)), temMais: Boolean(resposta.links?.next) };
    }

    /** A obra com esse nome no Kitsu (um dos nomes dela precisa bater), ou null. */
    async function obraPeloNome(titulo, formas) {
        const resultado = await pagina({ nome: titulo, ordem: 'RELEVANCIA', quantas: 5 });
        const procurado = new Set(formas(titulo));
        return resultado?.obras.find(obra => [...Object.values(obra.title), ...obra.synonyms].filter(Boolean)
            .some(nome => formas(nome).some(forma => procurado.has(forma)))) || null;
    }

    /**
     * Obras parecidas para a pagina de um manga: as populares com as categorias da propria obra (se o Kitsu a
     * conhece) e com as das tags do manga. Quem divide mais categorias vem primeiro. Devolve { obra, parecidas }, com
     * a propria obra (ou null) separada para nao ser sugerida. Formato do AniList.
     */
    async function parecidas(titulo, tagsDoManga, formas) {
        const obra = await obraPeloNome(titulo, formas);
        const daObra = (obra?.slugs || []).filter(slug => !CATEGORIAS_GERAIS.has(slug));
        const dasTags = [];
        for (const tag of tagsDoManga) {
            const slug = await categoriaDaTag(tag);
            if (slug && !dasTags.includes(slug)) dasTags.push(slug);
        }
        const referencia = [...new Set([...daObra, ...dasTags])];
        if (referencia.length === 0) return { obra, parecidas: [] };
        // o Kitsu pede "todas estas categorias": primeiro duas, e so uma se duas nao acharem nada
        let achadas = (await pagina({ slugs: referencia.slice(0, 2), quantas: 20 }))?.obras || [];
        if (achadas.length < 6 && referencia.length > 1) achadas.push(...((await pagina({ slugs: referencia.slice(0, 1), quantas: 20 }))?.obras || []));
        const emComum = parecida => parecida.slugs.filter(slug => referencia.includes(slug)).length;
        return { obra, parecidas: achadas.sort((a, b) => emComum(b) - emComum(a)) };
    }

    return { pagina, categoriaDaTag, parecidas };
}
