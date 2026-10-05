// Sugere mangas com temas parecidos com o de um manga da lista, para ler depois.
// Faz o mesmo que RecomendacaoService.java; uma mudanca de regra precisa ser feita nos dois.
// A fonte e o AniList: primeiro as recomendacoes que os leitores de la fizeram para a obra; se forem poucas,
// completa com obras populares dos mesmos generos e temas. Quem ja esta cadastrado nunca e sugerido.
import { clienteHttp } from './_sinopse.js';

export const QUANTIDADE = 6;
const VALIDADE_MS = 12 * 60 * 60 * 1000;
const MAXIMO_GUARDADO = 300;
const CAMPOS = 'id type isAdult title{romaji english} synonyms genres siteUrl coverImage{large}';
const GENEROS = {
    Action: 'Ação', Adventure: 'Aventura', Comedy: 'Comédia', Drama: 'Drama', Fantasy: 'Fantasia', Horror: 'Terror',
    Mystery: 'Mistério', Psychological: 'Psicológico', Romance: 'Romance', 'Sci-Fi': 'Ficção científica',
    'Slice of Life': 'Cotidiano', Sports: 'Esportes', Supernatural: 'Sobrenatural', Thriller: 'Suspense', Music: 'Música',
    'Mahou Shoujo': 'Garota mágica', Mecha: 'Mecha', Ecchi: 'Ecchi',
};

// tags sugeridas no cadastro que o AniList chama por outro nome
const TEMAS_COM_OUTRO_NOME = { murim: 'Wuxia', regression: 'Time Manipulation', 'school life': 'School', 'martial arts': 'Martial Arts' };

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** O titulo como esta e versoes mais curtas dele, para quando o cadastro tem subtitulo ou observacao a mais. */
export function variacoesDoTitulo(titulo) {
    const variacoes = new Set([titulo.trim(), titulo.replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim()]);
    for (const separador of [':', ' - ', ' – ']) {
        const posicao = titulo.indexOf(separador);
        if (posicao > 2) variacoes.add(titulo.slice(0, posicao).trim());
    }
    return [...variacoes].filter(Boolean).slice(0, 3);
}

/**
 * Devolve a funcao (titulo, titulosCadastrados, tagsDoManga) -> ate 6 sugestoes { titulo, capa, generos, link }.
 * Lista vazia se a obra nao for encontrada ou o servico falhar.
 */
export function criarBuscadorDeRecomendacoes(http = clienteHttp) {
    // as recomendacoes de uma obra mudam pouco: guardar evita consultar o AniList a cada visita a pagina do manga
    const guardados = new Map();

    const perguntar = async (query, variables) => (await http.postJson('https://graphql.anilist.co', { query, variables }))?.data ?? {};

    function adicionar(obra, candidatas, vistos) {
        if (!obra || obra.type !== 'MANGA' || obra.isAdult) return;
        const ingles = obra.title?.english || '';
        const romaji = obra.title?.romaji || '';
        const titulo = ingles.trim() ? ingles : romaji;
        const link = obra.siteUrl || '';
        if (!titulo.trim() || !link.startsWith('https://') || vistos.has(obra.id)) return;
        vistos.add(obra.id);
        const capa = obra.coverImage?.large || '';
        candidatas.push({
            recomendacao: {
                titulo,
                capa: capa.startsWith('https://') ? capa : '',
                generos: (obra.genres || []).map(genero => GENEROS[genero] || genero), // em portugues, para mostrar
                link,
                tags: obra.genres || [], // em ingles, para virar tags se a obra for cadastrada
            },
            nomes: new Set([ingles, romaji, ...(obra.synonyms || [])].map(normalizar).filter(Boolean)),
        });
    }

    /** Obras populares com algum dos generos e, se informados, algum dos temas; quem divide mais generos vem primeiro. */
    async function porGenerosETemas(generos, temas) {
        if (generos.length === 0 && temas.length === 0) return [];
        const parametros = [];
        const filtros = [];
        const variaveis = {};
        if (generos.length > 0) {
            parametros.push('$g:[String]');
            filtros.push('genre_in:$g,');
            variaveis.g = generos;
        }
        if (temas.length > 0) {
            parametros.push('$t:[String]');
            filtros.push('tag_in:$t,');
            variaveis.t = temas;
        }
        const parecidas = (await perguntar('query(' + parametros.join(',') + '){Page(perPage:30){media(type:MANGA,isAdult:false,'
            + filtros.join('') + 'sort:POPULARITY_DESC){' + CAMPOS + '}}}', variaveis)).Page?.media || [];
        const emComum = parecida => (parecida?.genres || []).filter(genero => generos.includes(genero)).length;
        return [...parecidas].sort((a, b) => emComum(b) - emComum(a));
    }

    async function consultar(titulo, tagsDoManga) {
        const candidatas = [];
        const vistos = new Set();

        // 1) pelo titulo: acha a obra no AniList
        let obra = null;
        for (const variacao of variacoesDoTitulo(titulo)) {
            obra = (await perguntar('query($s:String){Media(search:$s,type:MANGA){id genres tags{name rank} '
                + 'recommendations(sort:RATING_DESC,perPage:25){nodes{mediaRecommendation{' + CAMPOS + '}}}}}', { s: variacao })).Media;
            if (obra) break;
        }
        if (obra) {
            vistos.add(obra.id);
            // o que os leitores recomendaram para quem leu esta obra
            for (const no of obra.recommendations?.nodes || []) adicionar(no?.mediaRecommendation, candidatas, vistos);
            // poucas recomendacoes: completa com obras populares dos mesmos generos e dos temas mais marcantes dela
            if (candidatas.length < QUANTIDADE * 2) {
                const temas = (obra.tags || []).filter(tema => tema.rank >= 60).slice(0, 3).map(tema => tema.name);
                for (const parecida of await porGenerosETemas(obra.genres || [], temas)) adicionar(parecida, candidatas, vistos);
            }
        }

        // 2) pelas tags do manga na lista: completa o que veio do titulo, ou substitui quando o titulo nao foi encontrado
        if (candidatas.length < QUANTIDADE * 2 && tagsDoManga.length > 0) {
            const generos = [];
            const temas = [];
            for (const tag of tagsDoManga) {
                const genero = Object.keys(GENEROS).find(conhecido => normalizar(conhecido) === normalizar(tag));
                if (genero) generos.push(genero);
                else if (typeof tag === 'string' && tag.trim() && temas.length < 4) temas.push(TEMAS_COM_OUTRO_NOME[normalizar(tag)] ?? tag.trim());
            }
            let parecidas = await porGenerosETemas(generos, temas);
            // nenhuma obra com esses generos E esses temas (ou o AniList nao tem tema com esse nome): tenta so os generos
            if (parecidas.length === 0 && generos.length > 0 && temas.length > 0) parecidas = await porGenerosETemas(generos, []);
            for (const parecida of parecidas) adicionar(parecida, candidatas, vistos);
        }
        return candidatas;
    }

    /**
     * Procura pelo titulo e tambem pelas tags do manga: o titulo acha a obra e o que os leitores recomendam para
     * ela; as tags trazem obras dos mesmos generos e temas, inclusive quando o AniList nao conhece o titulo.
     */
    return async function buscarRecomendacoes(titulo, titulosCadastrados = [], tagsDoManga = []) {
        if (typeof titulo !== 'string' || !titulo.trim()) return [];
        const tags = Array.isArray(tagsDoManga) ? tagsDoManga : [];
        // as tags fazem parte da chave: mudar as tags do manga muda o que e sugerido
        const chave = normalizar(titulo) + '|' + tags.map(normalizar).filter(Boolean).sort().join(',');
        let guardado = guardados.get(chave);
        if (!guardado || Date.now() - guardado.quando > VALIDADE_MS) {
            const candidatas = await consultar(titulo.trim(), tags);
            guardado = { quando: Date.now(), candidatas };
            // falha ou obra desconhecida nao fica guardada: da para tentar de novo depois
            if (candidatas.length > 0) {
                if (guardados.size >= MAXIMO_GUARDADO) guardados.clear();
                guardados.set(chave, guardado);
            }
        }
        const cadastrados = new Set([titulo, ...titulosCadastrados].map(normalizar));
        return guardado.candidatas
            .filter(candidata => ![...candidata.nomes].some(nome => cadastrados.has(nome)))
            .slice(0, QUANTIDADE)
            .map(candidata => candidata.recomendacao);
    };
}
