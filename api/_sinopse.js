// Busca na internet a descricao de um manga pelo titulo, em portugues, para preencher o cadastro.
// Faz o mesmo que SinopseService.java; uma mudanca de regra precisa ser feita nos dois.
// Fontes, nesta ordem: MangaDex (tem descricoes em portugues escritas por pessoas), depois AniList (so em ingles,
// mas conhece mais obras). Quando so existe em ingles, o texto e traduzido pelo MyMemory.

const TAMANHO_MAXIMO = 1500;
const MAXIMO_POR_TRADUCAO = 450; // o MyMemory aceita ate 500 bytes por pedido
const MAXIMO_DE_TRADUCOES = 8;
// esses servicos pedem que cada programa se identifique
const IDENTIFICACAO = 'MeusMangas/1.0 (rastreador pessoal de leitura; github.com/GilvanPedro/ArmazenarManga)';

async function pedir(endereco, opcoes = {}) {
    try {
        const resposta = await fetch(endereco, {
            ...opcoes,
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': IDENTIFICACAO, Accept: 'application/json', ...(opcoes.headers || {}) },
        });
        return resposta.status === 200 ? await resposta.json() : null;
    } catch {
        return null;
    }
}

/** Chamadas de verdade. Devolvem o JSON da resposta, ou null quando nao da certo. */
export const clienteHttp = {
    get: endereco => pedir(endereco),
    postJson: (endereco, corpo) => pedir(endereco, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }),
};

const normalizar = texto => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Tira HTML, marcacoes e os avisos que as fontes colocam depois da descricao, e limita o tamanho. */
export function limpar(texto) {
    if (typeof texto !== 'string') return '';
    let limpo = texto.replaceAll('\r', '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&nbsp;', ' ');
    // no MangaDex, depois de uma linha "---" vem links e avisos que nao sao da historia
    const separador = limpo.indexOf('\n---');
    if (separador >= 0) limpo = limpo.slice(0, separador);
    limpo = limpo.replace(/\(\s*(source|fonte)\s*:[^)]*\)/gi, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [texto](link) -> texto
        .replace(/(\*\*|__|~~)/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (limpo.length > TAMANHO_MAXIMO) {
        const fim = limpo.lastIndexOf('. ', TAMANHO_MAXIMO);
        limpo = limpo.slice(0, fim > TAMANHO_MAXIMO / 2 ? fim + 1 : TAMANHO_MAXIMO).trim();
    }
    return limpo;
}

/** Divide em trechos de no maximo MAXIMO_POR_TRADUCAO letras, de preferencia no fim de uma frase. */
export function emPedacos(texto) {
    const pedacos = [];
    let resto = texto;
    while (resto.length > MAXIMO_POR_TRADUCAO) {
        let corte = Math.max(resto.lastIndexOf('. ', MAXIMO_POR_TRADUCAO), resto.lastIndexOf('! ', MAXIMO_POR_TRADUCAO), resto.lastIndexOf('? ', MAXIMO_POR_TRADUCAO));
        if (corte < 0) corte = resto.lastIndexOf(' ', MAXIMO_POR_TRADUCAO);
        corte = corte < 0 ? MAXIMO_POR_TRADUCAO : corte + 1;
        pedacos.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte).trim();
    }
    if (resto) pedacos.push(resto);
    return pedacos;
}

/**
 * Devolve a funcao (titulo) -> { descricao, idioma, fonte, tituloEncontrado, traduzida } ou null se nao achar.
 * idioma e "pt" ou, se a traducao falhou, "en". tituloEncontrado serve para conferir se e a mesma obra.
 */
export function criarBuscadorDeSinopse(http = clienteHttp) {
    async function buscarNoMangaDex(titulo) {
        const resposta = await http.get('https://api.mangadex.org/manga?limit=5&order%5Brelevance%5D=desc'
            + '&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&title=' + encodeURIComponent(titulo));
        const lista = Array.isArray(resposta?.data) ? resposta.data.map(manga => manga.attributes || {}) : [];
        // a busca de la e aproximada: se algum resultado tem exatamente este titulo, e ele
        const exato = lista.find(atributos => [
            ...Object.values(atributos.title || {}),
            ...(atributos.altTitles || []).flatMap(alternativo => Object.values(alternativo)),
        ].some(nome => normalizar(nome) === normalizar(titulo)));
        // quando bate exatamente, o nome a mostrar e o que foi pesquisado (o principal de la pode estar em outra lingua)
        if (exato) return { ...exato, nomeParaMostrar: titulo };
        return lista[0] || null;
    }
    const nomeNoMangaDex = atributos => atributos.nomeParaMostrar ?? atributos.title?.en ?? Object.values(atributos.title || {})[0] ?? '';

    /** Generos e temas da obra, em ingles, para sugerir como tags no cadastro. */
    const tagsDoMangaDex = atributos => (Array.isArray(atributos?.tags) ? atributos.tags : [])
        .filter(tag => ['genre', 'theme'].includes(tag?.attributes?.group) && tag.attributes.name?.en)
        .map(tag => tag.attributes.name.en)
        .slice(0, 8);

    async function buscarNoAniList(titulo) {
        const resposta = await http.postJson('https://graphql.anilist.co', {
            query: 'query($s:String){Page(perPage:1){media(search:$s,type:MANGA){title{romaji english} genres description(asHtml:false)}}}',
            variables: { s: titulo },
        });
        return resposta?.data?.Page?.media?.[0] ?? null;
    }

    /** Traduz do ingles para o portugues, aos pedacos. Devolve null se qualquer pedaco falhar. */
    async function traduzir(texto) {
        const paragrafos = [];
        let pedidos = 0;
        for (const paragrafo of texto.split('\n')) {
            if (!paragrafo.trim()) {
                paragrafos.push('');
                continue;
            }
            const traduzidos = [];
            for (const pedaco of emPedacos(paragrafo.trim())) {
                if (++pedidos > MAXIMO_DE_TRADUCOES) return null;
                const resposta = await http.get('https://api.mymemory.translated.net/get?langpair=en%7Cpt-br&q=' + encodeURIComponent(pedaco));
                const traduzido = String(resposta?.responseData?.translatedText ?? '');
                // quando a cota gratuita acaba, o servico responde com um aviso no lugar da traducao
                if (Number(resposta?.responseStatus) !== 200 || !traduzido.trim() || traduzido.toUpperCase().includes('MYMEMORY WARNING')) return null;
                traduzidos.push(traduzido.trim());
            }
            paragrafos.push(traduzidos.join(' '));
        }
        return paragrafos.join('\n').trim();
    }

    return async function buscarSinopse(titulo) {
        if (typeof titulo !== 'string' || !titulo.trim()) return null;
        const busca = titulo.trim();

        const mangadex = await buscarNoMangaDex(busca);
        for (const idioma of ['pt-br', 'pt']) {
            const emPortugues = limpar(mangadex?.description?.[idioma]);
            if (emPortugues) {
                return { descricao: emPortugues, idioma: 'pt', fonte: 'MangaDex', tituloEncontrado: nomeNoMangaDex(mangadex), traduzida: false, tags: tagsDoMangaDex(mangadex) };
            }
        }

        // so em ingles: AniList primeiro (conhece mais obras), depois o ingles do MangaDex
        let emIngles = '';
        let fonte = null;
        let nome = null;
        let tags = [];
        const anilist = await buscarNoAniList(busca);
        if (anilist) {
            tags = Array.isArray(anilist.genres) ? anilist.genres.filter(genero => typeof genero === 'string') : [];
            emIngles = limpar(anilist.description);
            fonte = 'AniList';
            nome = anilist.title?.english || anilist.title?.romaji || busca;
        }
        if (!emIngles && mangadex) {
            emIngles = limpar(mangadex.description?.en);
            fonte = 'MangaDex';
            nome = nomeNoMangaDex(mangadex);
            tags = tagsDoMangaDex(mangadex);
        }
        if (!emIngles) return null;
        const traduzida = await traduzir(emIngles);
        return traduzida !== null
            ? { descricao: traduzida, idioma: 'pt', fonte, tituloEncontrado: nome, traduzida: true, tags }
            : { descricao: emIngles, idioma: 'en', fonte, tituloEncontrado: nome, traduzida: false, tags };
    };
}
