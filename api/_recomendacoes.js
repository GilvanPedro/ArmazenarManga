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

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Devolve a funcao (titulo, titulosCadastrados) -> ate 6 sugestoes { titulo, capa, generos, link }.
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
                generos: (obra.genres || []).map(genero => GENEROS[genero] || genero),
                link,
            },
            nomes: new Set([ingles, romaji, ...(obra.synonyms || [])].map(normalizar).filter(Boolean)),
        });
    }

    async function consultar(titulo) {
        const obra = (await perguntar('query($s:String){Media(search:$s,type:MANGA){id genres tags{name rank} '
            + 'recommendations(sort:RATING_DESC,perPage:25){nodes{mediaRecommendation{' + CAMPOS + '}}}}}', { s: titulo })).Media;
        if (!obra) return [];
        const candidatas = [];
        const vistos = new Set([obra.id]);
        // 1) o que os leitores recomendaram para quem leu esta obra
        for (const no of obra.recommendations?.nodes || []) adicionar(no?.mediaRecommendation, candidatas, vistos);
        // 2) poucas recomendacoes: completa com obras populares dos mesmos generos e dos temas mais marcantes
        const generos = obra.genres || [];
        if (candidatas.length < QUANTIDADE * 2 && generos.length > 0) {
            const temas = (obra.tags || []).filter(tema => tema.rank >= 60).slice(0, 3).map(tema => tema.name);
            const comTemas = temas.length > 0;
            const parecidas = (await perguntar('query($g:[String]' + (comTemas ? ',$t:[String]' : '') + '){Page(perPage:30){media(type:MANGA,isAdult:false,'
                + 'genre_in:$g,' + (comTemas ? 'tag_in:$t,' : '') + 'sort:POPULARITY_DESC){' + CAMPOS + '}}}',
                comTemas ? { g: generos, t: temas } : { g: generos })).Page?.media || [];
            const emComum = parecida => (parecida.genres || []).filter(genero => generos.includes(genero)).length;
            // quem divide mais generos com a obra vem primeiro
            for (const parecida of [...parecidas].sort((a, b) => emComum(b) - emComum(a))) adicionar(parecida, candidatas, vistos);
        }
        return candidatas;
    }

    return async function buscarRecomendacoes(titulo, titulosCadastrados = []) {
        if (typeof titulo !== 'string' || !titulo.trim()) return [];
        const chave = normalizar(titulo);
        let guardado = guardados.get(chave);
        if (!guardado || Date.now() - guardado.quando > VALIDADE_MS) {
            const candidatas = await consultar(titulo.trim());
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
